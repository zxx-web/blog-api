import {
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';
import { BusinessException } from 'src/common/exceptions/business.exception';
import {
	POSTS_REPOSITORY,
	type PostsRepository
} from './repositories/posts.repository';
import { ErrorCodes } from 'src/common/constants/error-code';
import { decodeCursor } from './cursor';
import { SearchPostDto } from './dto/search-post.dto';
import { Post } from './entities/post.entity';
import { RedisService } from 'src/cache/redis.service';
import { setCacheState } from 'src/common/request-context';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/config/configuration';
import { RedisLockService } from 'src/cache/redis-lock.service';
import { TrendingService } from './trending.service';
import { StorageService, StoredFile } from 'src/storage/storage.service';
import { STORAGE_SERVICE } from 'src/storage/storage.constants';
import { ImageProcessorService } from 'src/storage/image-processor.service';
import { randomUUID } from 'node:crypto';

export interface Actor {
	sub: string;
	role: string;
}

@Injectable()
export class PostsService {
	private readonly logger = new Logger(PostsService.name);
	private static readonly postKey = (id: string) => `post:${id}`;
	private static readonly lockKey = (id: string) => `lock:post:${id}`;
	private static readonly LIST_PREFIX = 'posts:list';
	private static readonly NEGATIVE = '__NOT_FOUND__';
	private static readonly LOCK_WAIT_TRIES = 20;
	private static readonly LOCK_WAIT_INTERVAL_MS = 50;

	private readonly inFlight = new Map<string, Promise<unknown>>();

	constructor(
		@Inject(POSTS_REPOSITORY) private readonly repo: PostsRepository,
		@Optional() private readonly cache?: RedisService,
		@Optional() private readonly config?: ConfigService<AppConfig, true>,
		@Optional() private readonly locks?: RedisLockService,
		@Optional() private readonly trendingService?: TrendingService,
		@Optional()
		@Inject(STORAGE_SERVICE)
		private readonly storage?: StorageService,
		@Optional() private readonly imageProcessor?: ImageProcessorService
	) {}
	async create(dto: CreatePostDto, authorId: string) {
		if (await this.repo.findBySlug(dto.slug)) {
			throw new BusinessException(
				ErrorCodes.SLUG_TAKEN,
				`slug "${dto.slug}" 已被占用`,
				HttpStatus.CONFLICT
			);
		}
		const post = this.repo.create({
			title: dto.title,
			slug: dto.slug,
			content: dto.content,
			tags: dto.tags ?? [],
			status: dto.status,
			meta: dto.meta,
			authorId
		});

		await this.invalidate();
		return post;
	}

	async findAll(query: QueryPostDto) {
		if (!this.cache || !this.cache.available) {
			setCacheState('BYPASS');
			return this.loadList(query);
		}
		const key = PostsService.listKey(query);
		const cached = await this.cache.get(key);
		if (cached) {
			setCacheState('HIT', key);
			return this.deserializeList(cached);
		}
		const result = await this.coalesce(key, () => this.loadList(query));
		await this.cache.set(
			key,
			JSON.stringify(result),
			this.jitteredTtl(this.listTtl)
		);
		setCacheState('MISS', key);
		return result;
	}

	private async invalidate(postId?: string): Promise<void> {
		if (!this.cache) return;
		if (postId) await this.cache.del(PostsService.postKey(postId));
		await this.cache.delByPrefix(PostsService.LIST_PREFIX);
	}

	private static listKey(query: QueryPostDto): string {
		const normalize = JSON.stringify({
			page: query.page ?? 1,
			limit: query.limit ?? 20,
			sortBy: query.sortBy ?? 'createdAt',
			order: query.order ?? 'desc',
			keyword: query.keyword ?? '',
			tag: query.tag ?? '',
			status: query.status ?? ''
		});
		return `${PostsService.LIST_PREFIX}${normalize}`;
	}

	async loadList(query: QueryPostDto) {
		const { items, total } = await this.repo.findMany(query);
		return {
			items,
			pagination: {
				page: query.page ?? 1,
				limit: query.limit ?? 20,
				total
			}
		};
	}

	async findOne(id: string) {
		if (!this.cache || !this.cache.available) {
			setCacheState('BYPASS');
			return this.loadById(id);
		}
		const key = PostsService.postKey(id);
		const cached = await this.cache.get(key);
		if (cached !== null) {
			if (cached === PostsService.NEGATIVE) throw this.notFound(id);
			setCacheState('HIT', key);
			return this.deserializePost(cached);
		}
		const post = await this.coalesce(`rebuild:${id}`, () =>
			this.rebuildUnderLock(id, key)
		);
		setCacheState('MISS', key);
		return post;
	}

	private async rebuildUnderLock(id: string, key: string): Promise<Post> {
		if (!this.cache) return this.loadById(id);

		if (!this.locks) return this.loadAndCache(id, key);

		const token = await this.locks.acquire(
			PostsService.lockKey(id),
			this.lockTtl
		);

		if (token !== null) {
			try {
				const rechecked = await this.cache.get(key);
				if (rechecked !== null) {
					if (rechecked === PostsService.NEGATIVE) throw this.notFound(id);
					return this.deserializePost(rechecked);
				}
				return this.loadAndCache(id, key);
			} finally {
				await this.locks.release(PostsService.lockKey(id), token);
			}
		}

		for (let i = 0; i < PostsService.LOCK_WAIT_TRIES; i++) {
			await PostsService.sleep(PostsService.LOCK_WAIT_INTERVAL_MS);
			const c = await this.cache.get(key);
			if (c !== null) {
				if (c === PostsService.NEGATIVE) throw this.notFound(id);
				return this.deserializePost(c);
			}
		}

		return this.loadAndCache(id, key);
	}

	private async loadAndCache(id: string, key: string): Promise<Post> {
		if (!this.cache) return this.loadById(id);
		try {
			const post = await this.loadById(id);
			await this.cache.set(
				key,
				this.serializePost(post),
				this.jitteredTtl(this.postTtl)
			);
			return post;
		} catch (e) {
			if (
				e instanceof BusinessException &&
				e.bizCode === ErrorCodes.POST_NOT_FOUND
			) {
				await this.cache.set(key, PostsService.NEGATIVE, this.negativeTtl);
			}
			throw e;
		}
	}

	private static sleep(ms: number): Promise<void> {
		return new Promise((r) => setTimeout(r, ms));
	}

	private get postTtl(): number {
		return this.config?.get('redis.postTtlSec', { infer: true }) ?? 300;
	}

	private get listTtl(): number {
		return this.config?.get('redis.listTtlSec', { infer: true }) ?? 60;
	}

	private get lockTtl(): number {
		return this.config?.get('redis.lockTtlSec', { infer: true }) ?? 3;
	}

	private get negativeTtl(): number {
		return this.config?.get('redis.negativeTtlSec', { infer: true }) ?? 30;
	}

	private jitteredTtl(base: number): number {
		const jitter =
			this.config?.get('redis.ttlJitterSec', { infer: true }) ?? 60;
		return base + Math.floor(Math.random() * (jitter + 1));
	}

	private async coalesce<T>(key: string, loader: () => Promise<T>): Promise<T> {
		const existing = this.inFlight.get(key);
		if (existing) return existing as Promise<T>;
		const promise = loader().finally(() => this.inFlight.delete(key));
		this.inFlight.set(key, promise);
		return promise;
	}

	private serializePost(post: Post): string {
		return JSON.stringify(post);
	}

	private deserializePost(raw: string): Post {
		return this.revivePost(JSON.parse(raw) as Post);
	}

	private revivePost(p: Post): Post {
		return {
			...p,
			createdAt: new Date(p.createdAt),
			updatedAt: new Date(p.updatedAt)
		};
	}

	private deserializeList(raw: string): {
		items: Post[];
		pagination: { page: number; limit: number; total: number };
	} {
		const obj = JSON.parse(raw) as {
			items: Post[];
			pagination: { page: number; limit: number; total: number };
		};
		return {
			items: obj.items.map((i) => this.revivePost(i)),
			pagination: obj.pagination
		};
	}

	private notFound(id: string): BusinessException {
		throw new BusinessException(
			ErrorCodes.POST_NOT_FOUND,
			`Post ${id} not found`,
			HttpStatus.NOT_FOUND
		);
	}

	private assertCanModify(post: Post, actor: Actor) {
		if (actor.role === 'admin') return;
		if (post.authorId && post.authorId === actor.sub) return;
		throw new BusinessException(
			ErrorCodes.FORBIDDEN,
			'只有作者或管理员能修改',
			HttpStatus.FORBIDDEN
		);
	}

	async update(id: string, dto: UpdatePostDto, actor: Actor) {
		const post = await this.loadById(id);
		this.assertCanModify(post, actor);
		if (post.status === 'archived') {
			throw new BusinessException(
				ErrorCodes.POST_ARCHIVED,
				`post ${id}已归档，不能再修改`,
				HttpStatus.CONFLICT
			);
		}

		if (dto.slug && dto.slug !== post.slug) {
			const exists = await this.repo.findBySlug(dto.slug);
			if (exists) {
				throw new BusinessException(
					ErrorCodes.SLUG_TAKEN,
					`slug "${dto.slug}" 已被占用`,
					HttpStatus.CONFLICT
				);
			}
		}
		const { version, ...rest } = dto;
		const patch = Object.fromEntries(
			Object.entries(rest).filter(([, v]) => v !== undefined)
		);
		const updated = await this.repo.update(id, patch, version);
		if (!updated) {
			// 极少出现：update 之前刚 findOne 通过，理论上不会到这；防御性兜底
			throw new NotFoundException(`Post #${id} not found`);
		}
		await this.invalidate(id);
		return updated;
	}

	async remove(id: string, actor: Actor) {
		const post = await this.loadById(id);
		this.assertCanModify(post, actor);
		const ok = await this.repo.remove(id);
		if (!ok) {
			throw new BusinessException(
				ErrorCodes.POST_NOT_FOUND,
				`Post #${id} not found`,
				HttpStatus.NOT_FOUND
			);
		}
		await this.invalidate(id);
		await this.trendingService?.drop(id);
		return { deleted: true, id };
	}

	async feed(query: QueryPostDto) {
		const cursor = query.cursor ? decodeCursor(query.cursor) : null;

		if (query.cursor && !cursor) {
			throw new BusinessException(
				ErrorCodes.VALIDATION_ERROR,
				'cursor 参数非法',
				HttpStatus.BAD_REQUEST
			);
		}

		const { items, nextCursor } = await this.repo.findByCursor(query, cursor);

		return {
			items,
			pageInfo: {
				nextCursor,
				hasMore: nextCursor !== null,
				limit: query.limit ?? 20
			}
		};
	}

	async search(query: SearchPostDto) {
		const { items, total } = await this.repo.search(query);
		return {
			items,
			pagination: {
				page: query.page ?? 1,
				limit: query.limit ?? 20,
				total
			}
		};
	}

	private async loadById(id: string): Promise<Post> {
		const post = await this.repo.findById(id);
		if (!post) {
			throw new BusinessException(
				ErrorCodes.POST_NOT_FOUND,
				`Post #${id} not found`,
				HttpStatus.NOT_FOUND
			);
		}
		return post;
	}

	async listRevisions(id: string) {
		await this.loadById(id);
		return this.repo.listRevisions(id);
	}

	async incrementView(id: string) {
		const post = await this.repo.incrementViewCount(id);
		if (!post) {
			throw new BusinessException(
				ErrorCodes.POST_NOT_FOUND,
				`Post #${id} not found`,
				HttpStatus.NOT_FOUND
			);
		}
		await this.trendingService?.bump(id);
		return post;
	}

	async trending(limit: number): Promise<{ items: Post[] }> {
		const ids = this.trendingService
			? await this.trendingService.top(limit)
			: [];
		if (ids.length > 0) {
			const items: Post[] = [];
			for (const { id } of ids) {
				try {
					items.push(await this.findOne(id));
				} catch {
					await this.trendingService?.drop(id);
				}
				if (items.length >= limit) break;
			}
			if (items.length > 0) return { items };
		}
		return { items: await this.repo.findTopByViewCount(limit) };
	}

	async uploadCover(
		id: string,
		file: Express.Multer.File,
		actor: Actor
	): Promise<Post> {
		if (!file) {
			throw new BusinessException(
				ErrorCodes.INVALID_FILE,
				'未上传文件(multipart字段名需为file)',
				HttpStatus.BAD_REQUEST
			);
		}
		const post = await this.loadById(id);
		this.assertCanModify(post, actor);
		if (!this.storage || !this.imageProcessor) {
			throw new BusinessException(
				ErrorCodes.STORAGE_FAILED,
				'存储服务未配置',
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}

		const processed = await this.imageProcessor.processCover(file.buffer);

		const key = `covers/${id}/${randomUUID()}.${processed.ext}`;

		let stored: StoredFile;

		try {
			stored = await this.storage.save({
				buffer: processed.buffer,
				key,
				contentType: processed.contentType
			});
		} catch (e) {
			this.logger.error(`封面存储失败: ${(e as Error).message}`);
			throw new BusinessException(
				ErrorCodes.STORAGE_FAILED,
				'文件存储失败, 请稍后重试',
				HttpStatus.BAD_GATEWAY
			);
		}

		const updated = await this.repo.setCoverImage(id, stored.url);
		if (!updated) throw this.notFound(id);

		await this.invalidate(id);

		const oldUrl = post.meta?.coverImage;
		if (oldUrl && oldUrl !== stored.url) {
			void this.tryDeleteByUrl(oldUrl);
		}

		return updated;
	}

	private async tryDeleteByUrl(url: string): Promise<void> {
		try {
			const key = this.storage?.keyFromPublicUrl(url);
			if (key) await this.storage?.delete(key);
		} catch (e) {
			this.logger.warn(
				`清理旧封面失败(已忽略)${url}: ${(e as Error).message} `
			);
		}
	}

	triggerBoom() {
		throw new Error('boom! 这条 message 不应该被客户端看到');
	}
}
