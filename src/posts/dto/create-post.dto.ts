import {
	ArrayMaxSize,
	IsArray,
	IsEnum,
	IsOptional,
	IsString,
	Length,
	MinLength,
	ValidateNested
} from 'class-validator';
import { PostMetaDto } from './post-meta.dto';
import { Type } from 'class-transformer';
import { IsSlug } from 'src/common/validators/is-slug.validator';
import { POST_STATUSES, type PostStatus } from '../entities/post.entity';

export class CreatePostDto {
	@IsString()
	@Length(1, 100, { message: 'title 长度需在 1-100' })
	title!: string;

	@IsSlug()
	slug!: string;

	@IsString()
	@MinLength(10, { message: 'content 至少10个字符' })
	content!: string;

	@IsOptional()
	@IsArray()
	@ArrayMaxSize(10)
	@IsString({ each: true })
	@Length(1, 20, { each: true })
	tags?: string[];

	@IsEnum(POST_STATUSES, {
		message: `status 必须是 ${POST_STATUSES.join(' / ')}`
	})
	status!: PostStatus;

	@IsOptional()
	@ValidateNested()
	@Type(() => PostMetaDto)
	meta?: PostMetaDto;
}
