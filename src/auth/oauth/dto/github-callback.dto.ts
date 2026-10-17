import { IsOptional, IsString } from 'class-validator';

export class GithubCallbackDto {
	@IsOptional()
	@IsString()
	code?: string;

	@IsOptional()
	@IsString()
	state?: string;

	@IsOptional()
	@IsString()
	iss?: string;

	@IsOptional()
	@IsString()
	error?: string;

	@IsOptional()
	@IsString()
	error_description?: string;
}
