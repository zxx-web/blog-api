import { IsOptional, IsString, Length } from 'class-validator';

export class PostMetaDto {
	@IsString()
	@Length(1, 70, { message: 'seoTitle 长度需在 1-70' })
	seoTitle!: string;

	@IsString()
	@Length(1, 160, { message: 'seoTitle 长度需在 1-160' })
	seoDescription!: string;

	@IsOptional()
	@IsString()
	@Length(1, 2048)
	coverImage?: string;
}
