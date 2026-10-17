import { CursorPayload } from '../cursor';
import { QueryPostDto } from '../dto/query-post.dto';
import { SearchPostDto } from '../dto/search-post.dto';
import { Post, PostRevisions, PostWriteData } from '../entities/post.entity';

export const POSTS_REPOSITORY = Symbol('POSTS_REPOSITORY');

export interface CursorResult {
	items: Post[];
	nextCursor: string | null;
}

export interface PostsRepository {
	create(data: PostWriteData): Promise<Post>;
	findById(id: string): Promise<Post | null>;
	findBySlug(slug: string): Promise<Post | null>;
	findMany(query: QueryPostDto): Promise<{ items: Post[]; total: number }>;
	update(
		id: string,
		patch: Partial<Omit<Post, 'id' | 'createdAt'>>,
		expectedVersion?: number
	): Promise<Post | null>;
	remove(id: string): Promise<boolean>;
	findByCursor(
		query: QueryPostDto,
		cursor: CursorPayload | null
	): Promise<CursorResult>;
	search(query: SearchPostDto): Promise<{ items: Post[]; total: number }>;
	listRevisions(id: string): Promise<PostRevisions[]>;
	incrementViewCount(id: string): Promise<Post | null>;
	findTopByViewCount(limit: number): Promise<Post[]>;
	setCoverImage(postId: string, coverUrl: string | null): Promise<Post | null>;
}
