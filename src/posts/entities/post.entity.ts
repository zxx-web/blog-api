export type PostStatus = 'draft' | 'published' | 'archived';

export const POST_STATUSES: PostStatus[] = ['draft', 'published', 'archived'];

export interface PostMeta {
	seoTitle: string;
	seoDescription: string;
	coverImage?: string;
}

export interface Post {
	id: string;
	title: string;
	slug: string;
	content: string;
	tags: string[];
	status: PostStatus;
	meta?: PostMeta;
	version: number;
	viewCount: number;
	authorId?: string;
	createdAt: Date;
	updatedAt: Date;
}

export type PostWriteData = Omit<
	Post,
	'id' | 'createdAt' | 'updatedAt' | 'version' | 'viewCount'
>;

export interface PostRevisions {
	id: string;
	postId: string;
	version: number;
	title: string;
	content: string;
	createdAt: Date;
}
