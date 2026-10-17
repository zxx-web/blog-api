import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	Res,
	UseFilters,
	UseGuards
} from '@nestjs/common';
import { BusinessExceptionFilter } from 'src/common/filters/business-exception.filter';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { currentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard, type JwtPayload } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import type { Response } from 'express';
import { GithubOauthProvider } from './oauth/github-oauth.provider';
import { OauthStateStore } from './oauth/oauth-state.store';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ErrorCodes } from 'src/common/constants/error-code';
import { GithubCallbackDto } from './oauth/dto/github-callback.dto';
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 30, ttl: 60000 } })
@UseFilters(BusinessExceptionFilter)
@Controller('auth')
export class AuthController {
	constructor(
		private readonly auth: AuthService,
		private readonly github: GithubOauthProvider,
		private readonly stateStore: OauthStateStore
	) {}

	@Post('register')
	@HttpCode(HttpStatus.CREATED)
	register(@Body() dto: RegisterDto) {
		return this.auth.register(dto);
	}

	@Post('login')
	@HttpCode(HttpStatus.OK)
	login(@Body() dto: LoginDto) {
		return this.auth.login(dto);
	}

	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	refresh(@Body() dto: RefreshDto) {
		return this.auth.refresh(dto.refreshToken);
	}

	@Post('logout')
	@HttpCode(HttpStatus.OK)
	logout(@Body() dto: RefreshDto) {
		return this.auth.logout(dto.refreshToken);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	me(@currentUser() user: JwtPayload) {
		return this.auth.me(user.sub);
	}

	@Get('users')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin')
	listUsers() {
		return this.auth.listUsers();
	}

	@Get('github')
	githubLogin(@Res() res: Response) {
		if (!this.github.isConfigured()) {
			throw new BusinessException(
				ErrorCodes.OAUTH_NOT_CONFIGURED,
				'本服务未配置 GitHub OAuth',
				HttpStatus.SERVICE_UNAVAILABLE
			);
		}
		const state = this.stateStore.generate();
		res.redirect(this.github.getAuthorizeUrl(state));
	}

	@Get('github/callback')
	async githubCallback(@Query() query: GithubCallbackDto) {
		if (query.error) {
			throw new BusinessException(
				ErrorCodes.OAUTH_FAILED,
				`GitHub 授权被拒绝：${query.error_description ?? query.error}
				`,
				HttpStatus.UNAUTHORIZED
			);
		}

		if (!query.code || !query.state || !this.stateStore.consume(query.state)) {
			throw new BusinessException(
				ErrorCodes.OAUTH_STATE_INVALID,
				'state 无效或已过期（可能是 CSRF 或重复回调）',
				HttpStatus.UNAUTHORIZED
			);
		}

		const githubToken = await this.github.exchangeCodeToToken(query.code);
		const ghUser = await this.github.fetchGithubUser(githubToken);

		return this.auth.loginWithGithub(ghUser);
	}
}
