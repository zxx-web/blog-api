import { Transform } from 'class-transformer';
import {
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength
} from 'class-validator';
import { POST_STATUSES, type PostStatus } from '../entities/post.entity';

export class SearchPostDto {
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MinLength(1, { message: 'q 不能为空' })
	@MaxLength(100)
	q!: string;

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
	@IsEnum(POST_STATUSES)
	status?: PostStatus;
}
