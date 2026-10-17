import { HttpStatus, Injectable } from '@nestjs/common';
import { CursorResult, PostsRepository } from './posts.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import {
	Post,
	PostMeta,
	PostRevisions,
	PostStatus,
	PostWriteData
} from '../entities/post.entity';
import {
	Prisma,
	type Post as PrismaPost,
	type PostRevision as PrismaPostRevision
} from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ErrorCodes } from 'src/common/constants/error-code';
import { QueryPostDto } from '../dto/query-post.dto';
import { CursorPayload, encodeCursor } from '../cursor';
import { SearchPostDto } from '../dto/search-post.dto';

@Injectable()
export class PrismaPostsRepository implements PostsRepository {
	constructor(private readonly prisma: PrismaService) {}
	private toDomain(row: PrismaPost): Post {
		return {
			id: row.id,
			title: row.title,
			slug: row.slug,
			content: row.content,
			tags: row.tags,
			status: row.status as PostStatus,
			meta: (row.meta ?? undefined) as PostMeta | undefined,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			version: row.version,
			viewCount: row.viewCount,
			authorId: row.authorId ?? undefined
		};
	}
	private toRevision(row: PrismaPostRevision): PostRevisions {
		return {
			id: row.id,
			postId: row.postId,
			version: row.version,
			title: row.title,
			content: row.content,
			createdAt: row.createdAt
		};
	}
	private isSlugConflict(e: unknown): boolean {
		if (
			!(e instanceof Prisma.PrismaClientKnownRequestError) ||
			e.code !== 'P2002'
		) {
			return false;
		}
		// P2002 的 meta.target 是冲突字段名数组（或约束名），slug 冲突里一定含 'slug'
		const target = (e.meta as { target?: unknown } | undefined)?.target;
		return JSON.stringify(target ?? '').includes('slug');
	}
	private slugTaken(): BusinessException {
		return new BusinessException(
			ErrorCodes.SLUG_TAKEN,
			'slug 已被占用',
			HttpStatus.CONFLICT
		);
	}
	private versionConflict(): BusinessException {
		return new BusinessException(
			ErrorCodes.VERSION_CONFLICT,
			'文章已被其他人修改，请刷新后重试',
			HttpStatus.CONFLICT
		);
	}
	private baseWhere(query: {
		keyword?: string;
		status?: PostStatus;
		tag?: string;
	}): Prisma.PostWhereInput {
		const where: Prisma.PostWhereInput = {};
		if (query.keyword) {
			where.OR = [
				{ title: { contains: query.keyword, mode: 'insensitive' } },
				{ content: { contains: query.keyword, mode: 'insensitive' } }
			];
		}
		if (query.status) where.status = query.status;
		if (query.tag) where.tags = { has: query.tag };
		return where;
	}
	private cursorOf(row: PrismaPost, sortBy) {
		const v =
			sortBy === 'title'
				? row.title
				: row[sortBy as 'createdAt' | 'updatedAt'].toISOString();
		return encodeCursor({ v, id: row.id });
	}
	async findByCursor(
		query: QueryPostDto,
		cursor: CursorPayload | null
	): Promise<CursorResult> {
		const limit = query.limit ?? 20;
		const sortBy = query.sortBy ?? 'createdAt';
		const order = query.order ?? 'desc';

		const op = order === 'asc' ? 'gt' : 'lt';

		const where = this.baseWhere(query);

		if (cursor) {
			const v = sortBy === 'title' ? cursor.v : new Date(cursor.v);

			const keyset: Prisma.PostWhereInput = {
				OR: [
					{ [sortBy]: { [op]: v } },
					{ [sortBy]: v, id: { [op]: cursor.id } }
				]
			};

			where.AND = [...(Array.isArray(where.AND) ? where.AND : []), keyset];
		}

		const rows = await this.prisma.post.findMany({
			where,
			orderBy: [
				{
					[sortBy]: order
				},
				{
					id: order
				}
			],
			take: limit + 1
		});

		const hasMore = rows.length > limit;
		const page = hasMore ? rows.slice(0, limit) : rows;

		const nextCursor = hasMore
			? this.cursorOf(page[page.length - 1], sortBy)
			: null;

		return { items: page.map((p) => this.toDomain(p)), nextCursor };
	}
	async search(
		query: SearchPostDto
	): Promise<{ items: Post[]; total: number }> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const offset = (page - 1) * limit;

		const statusFilter = query.status
			? Prisma.sql`AND status = ${query.status}`
			: Prisma.empty;

		const rows = await this.prisma.$queryRaw<
			Array<PrismaPost & { total: bigint }>
		>`
			    SELECT id, title, slug, content, tags, status, meta,
						created_at AS "createdAt",
						updated_at AS "updatedAt",
						count(*) OVER() AS total
				FROM posts
				WHERE to_tsvector('simple', title || ' ' || content)
						@@ websearch_to_tsquery('simple', ${query.q})
						${statusFilter}
				ORDER BY ts_rank(
							to_tsvector('simple', title || ' ' || content),
							websearch_to_tsquery('simple', ${query.q})
						) DESC,
						created_at DESC,
						id DESC
				LIMIT ${limit} OFFSET ${offset}
		`;

		const total = rows.length > 0 ? Number(rows[0].total) : 0;
		return { items: rows.map((r) => this.toDomain(r)), total };
	}
	async create(data: PostWriteData): Promise<Post> {
		try {
			const row = await this.prisma.post.create({
				data: {
					title: data.title,
					slug: data.slug,
					content: data.content,
					tags: data.tags,
					status: data.status,
					authorId: data.authorId,
					...(data.meta !== undefined
						? { meta: data.meta as unknown as Prisma.InputJsonValue }
						: {})
				}
			});
			return this.toDomain(row);
		} catch (error) {
			if (this.isSlugConflict(error)) throw this.slugTaken();
			throw error;
		}
	}
	async findById(id: string): Promise<Post | null> {
		const row = await this.prisma.post.findUnique({ where: { id } });
		return row ? this.toDomain(row) : null;
	}
	async findBySlug(slug: string): Promise<Post | null> {
		const row = await this.prisma.post.findUnique({ where: { slug } });
		return row ? this.toDomain(row) : null;
	}
	async findMany(
		query: QueryPostDto
	): Promise<{ items: Post[]; total: number }> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const sortBy = query.sortBy ?? 'createdAt';
		const order = query.order ?? 'desc';

		const where = this.baseWhere(query);
		const [rows, total] = await this.prisma.$transaction([
			this.prisma.post.findMany({
				where,
				orderBy: [{ [sortBy]: order }, { id: 'asc' }],
				skip: (page - 1) * limit,
				take: limit
			}),
			this.prisma.post.count({ where })
		]);

		return { items: rows.map((r) => this.toDomain(r)), total };
	}
	async update(
		id: string,
		patch: Partial<PostWriteData>,
		expectedVersion?: number
	): Promise<Post | null> {
		const data: Prisma.PostUpdateInput = { version: { increment: 1 } };
		if (patch.title !== undefined) data.title = patch.title;
		if (patch.slug !== undefined) data.slug = patch.slug;
		if (patch.content !== undefined) data.content = patch.content;
		if (patch.tags !== undefined) data.tags = patch.tags;
		if (patch.status !== undefined) data.status = patch.status;
		if (patch.meta !== undefined)
			data.meta = patch.meta as unknown as Prisma.InputJsonValue;

		try {
			return await this.prisma.$transaction(async (tx) => {
				let row: PrismaPost;
				if (expectedVersion !== undefined) {
					const res = await tx.post.updateMany({
						where: { id, version: expectedVersion },
						data
					});

					if (res.count === 0) {
						const exist = await tx.post.findUnique({ where: { id } });
						if (!exist) return null;
						throw this.versionConflict();
					}
					row = await tx.post.findUniqueOrThrow({ where: { id } });
				} else {
					row = await tx.post.update({ where: { id }, data });
				}

				await tx.postRevision.create({
					data: {
						postId: row.id,
						version: row.version,
						title: row.title,
						content: row.content
					}
				});

				return this.toDomain(row);
			});
		} catch (e) {
			if (
				e instanceof Prisma.PrismaClientKnownRequestError &&
				e.code === 'P2025'
			) {
				return null;
			}
			if (this.isSlugConflict(e)) throw this.slugTaken();
			throw e;
		}
	}
	async remove(id: string): Promise<boolean> {
		try {
			await this.prisma.post.delete({ where: { id } });
			return true;
		} catch (e) {
			if (
				e instanceof Prisma.PrismaClientKnownRequestError &&
				e.code === 'P2025'
			) {
				return false;
			}
			throw e;
		}
	}
	async listRevisions(id: string): Promise<PostRevisions[]> {
		const rows = await this.prisma.postRevision.findMany({
			where: { postId: id },
			orderBy: { version: 'desc' }
		});
		return rows.map((r) => this.toRevision(r));
	}

	async incrementViewCount(id: string): Promise<Post | null> {
		// 裸sql避免@updateAt更新
		try {
			const rows = await this.prisma.$queryRaw<PrismaPost[]>`
				UPDATE post SET view_count = view_count + 1
				WHERE id=${id}::uuid
				RETURNING id, title, slug, content, tags, status, meta, version,
						view_count AS "viewCount",
						created_at AS "createdAt",
						updated_at AS "updatedAt"
			`;
			return rows.length > 0 ? this.toDomain(rows[0]) : null;
		} catch (e) {
			if (
				e instanceof Prisma.PrismaClientKnownRequestError &&
				e.code === 'P2025'
			) {
				return null;
			}
			throw e;
		}
	}

	async findTopByViewCount(limit: number): Promise<Post[]> {
		const rows = await this.prisma.post.findMany({
			where: { status: 'published' },
			orderBy: { viewCount: 'desc', id: 'asc' },
			take: limit
		});
		return rows.map((r) => this.toDomain(r));
	}

	async setCoverImage(
		postId: string,
		coverUrl: string | null
	): Promise<Post | null> {
		try {
			const current = await this.prisma.post.findUnique({
				where: { id: postId },
				select: { meta: true }
			});

			if (!current) return null;
			const base = (current.meta ?? {}) as Record<string, unknown>;
			if (coverUrl === null) delete base.coverImage;
			else base.coverImage = coverUrl;

			const row = await this.prisma.post.update({
				where: { id: postId },
				data: {
					meta: base as unknown as Prisma.InputJsonValue
				}
			});

			return this.toDomain(row);
		} catch (e) {
			if (
				e instanceof Prisma.PrismaClientKnownRequestError &&
				e.code === 'P2025'
			) {
				return null;
			}
			throw e;
		}
	}
}
