import {
	IsOptional,
	IsInt,
	IsString,
	Min,
	Max,
	IsIn,
	MaxLength,
	IsEnum
} from 'class-validator';
import { POST_STATUSES, type PostStatus } from '../entities/post.entity';

const SORT_FIELDS = ['createdAt', 'updatedAt', 'title'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export class QueryPostDto {
	@IsOptional()
	@IsInt()
	@Min(1)
	page?: number;

	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;

	@IsOptional()
	@IsIn(SORT_FIELDS)
	sortBy?: SortField;

	@IsOptional()
	@IsIn(['asc', 'desc'])
	order?: 'asc' | 'desc';

	@IsOptional()
	@IsString()
	@MaxLength(100)
	keyword?: string;

	@IsOptional()
	@IsString()
	tag?: string;

	@IsOptional()
	@IsEnum(POST_STATUSES)
	status?: PostStatus;

	@IsOptional()
	@IsString()
	@MaxLength(500)
	cursor?: string;
}
