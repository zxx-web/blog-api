import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { IssuedTokens, TokensService } from './tokens.service';
import { RegisterDto } from './dto/register.dto';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ErrorCodes } from 'src/common/constants/error-code';
import * as bcrypt from 'bcryptjs';
import { Prisma, User } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { GithubUser } from './oauth/github-oauth.provider';
import { randomBytes } from 'node:crypto';
import { MailQueueService } from 'src/queue/mail-queue.service';
import { LoginAttemptService } from 'src/cache/login-attempt.service';

const BCRYPT_COST = 10;
const DUMMY_HASH = bcrypt.hashSync(
	'a-dummy-value-for-constant-time-login',
	BCRYPT_COST
);

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly tokens: TokensService,
		@Optional() private readonly mail?: MailQueueService,
		@Optional() private readonly loginAttempts?: LoginAttemptService
	) {}
	async register(dto: RegisterDto) {
		if (
			await this.prisma.user.findUnique({
				where: { email: dto.email },
				select: { id: true }
			})
		) {
			throw this.emailTaken();
		}
		if (
			await this.prisma.user.findUnique({
				where: { username: dto.username },
				select: { id: true }
			})
		) {
			throw this.usernameTaken();
		}
		const password = await bcrypt.hash(dto.password, BCRYPT_COST);
		let user: User;
		try {
			user = await this.prisma.user.create({
				data: { email: dto.email, username: dto.username, password }
			});
		} catch (e) {
			if (
				e instanceof Prisma.PrismaClientKnownRequestError &&
				e.code === 'P2002'
			) {
				const target = JSON.stringify(
					(e.meta as { target?: unknown })?.target ?? ''
				);
				throw target.includes('email')
					? this.emailTaken()
					: this.usernameTaken();
			}
			throw e;
		}

		await this.mail?.enqueue({
			kind: 'welcome',
			to: dto.email,
			subject: `欢迎加入，${dto.username}`,
			body: `你好 ${dto.username}，感谢注册，这是一封由消息队列异步发送的欢迎邮件`,
			idempotencyKey: `welcome_${user.id}`
		});
		// return this.authResponse(user, await this.tokens.issue(user));
		// 仅返回成功,让用户手动登录
		return { success: true };
	}
	async login(dto: LoginDto) {
		if (await this.loginAttempts?.isLocked(dto.email)) {
			throw new BusinessException(
				ErrorCodes.ACCOUNT_LOCKED,
				'账号因连续登录失败已被临时锁定，请稍后再试',
				HttpStatus.LOCKED
			);
		}
		const user = await this.prisma.user.findUnique({
			where: { email: dto.email }
		});
		const ok = await bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH);
		if (!user || !ok) {
			await this.loginAttempts?.recordFailure(dto.email);
			throw new BusinessException(
				ErrorCodes.INVALID_CREDENTIALS,
				'邮箱或密码错误',
				HttpStatus.UNAUTHORIZED
			);
		}
		await this.loginAttempts?.clear(dto.email);
		return this.authResponse(user, await this.tokens.issue(user));
	}
	async refresh(rawRefresh: string) {
		const { user, tokens } = await this.tokens.rotate(rawRefresh);
		return this.authResponse(user, tokens);
	}
	async logout(rawRefresh: string) {
		await this.tokens.revoke(rawRefresh);
		return { success: true };
	}
	async me(userId: string) {
		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!user) {
			throw new BusinessException(
				ErrorCodes.UNAUTHORIZED,
				'用户不存在',
				HttpStatus.UNAUTHORIZED
			);
		}
		return this.toUserResponse(user);
	}
	async listUsers() {
		const user = await this.prisma.user.findMany({
			orderBy: { createdAt: 'desc' },
			take: 100
		});
		return user.map((u) => this.toUserResponse(u));
	}
	private authResponse(user: User, tokens: IssuedTokens) {
		return { ...tokens, tokenType: 'Bearer', user: this.toUserResponse(user) };
	}
	private toUserResponse(user: User) {
		return {
			id: user.id,
			email: user.email,
			username: user.username,
			role: user.role,
			createdAt: user.createdAt
		};
	}
	private emailTaken() {
		return new BusinessException(
			ErrorCodes.EMAIL_TAKEN,
			'该邮箱已注册',
			HttpStatus.CONFLICT
		);
	}
	private usernameTaken() {
		return new BusinessException(
			ErrorCodes.USERNAME_TAKEN,
			'该用户名已被占用',
			HttpStatus.CONFLICT
		);
	}

	async loginWithGithub(gh: GithubUser) {
		let user = await this.prisma.user.findUnique({
			where: { githubId: gh.id }
		});

		if (!user && gh.email) {
			const existing = await this.prisma.user.findUnique({
				where: { email: gh.email }
			});
			if (existing) {
				user = await this.prisma.user.update({
					where: { email: gh.email },
					data: { githubId: gh.id }
				});
			}
		}

		if (!user) {
			user = await this.prisma.user.create({
				data: {
					email: gh.email ?? `${gh.id}+${gh.login}@users.noreply.github.com`,
					username: await this.uniqueUsername(gh.login),
					githubId: gh.id,
					password: null
				}
			});
		}

		return this.authResponse(user, await this.tokens.issue(user));
	}

	private async uniqueUsername(base: string): Promise<string> {
		let cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
		if (cleaned.length < 3) cleaned = `gh-${cleaned || 'user'}`;
		for (let i = 0; i < 5; i++) {
			const candidate =
				i === 0 ? cleaned : `${cleaned}-${randomBytes(2).toString('hex')}`;
			const exists = await this.prisma.user.findUnique({
				where: { username: candidate },
				select: { id: true }
			});
			if (!exists) return candidate;
		}
		return `${cleaned}-${randomBytes(4).toString('hex')}`;
	}
}
