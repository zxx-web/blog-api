import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { ErrorCodes } from 'src/common/constants/error-code';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { AppConfig } from 'src/config/configuration';
import { PrismaService } from 'src/prisma/prisma.service';

export interface IssuedTokens {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

@Injectable()
export class TokensService {
	constructor(
		private readonly jwt: JwtService,
		private readonly prisma: PrismaService,
		private readonly config: ConfigService<AppConfig, true>
	) {}

	private hash(raw: string): string {
		return createHash('sha256').update(raw).digest('hex');
	}

	async issue(
		user: Pick<User, 'id' | 'role'>,
		client: Prisma.TransactionClient = this.prisma
	): Promise<IssuedTokens> {
		const accessToken = await this.jwt.signAsync({
			sub: user.id,
			role: user.role
		});
		const refreshToken = randomBytes(32).toString('base64url');
		const days = this.config.get('auth.refreshTtlDays', { infer: true });
		await client.refreshToken.create({
			data: {
				userId: user.id,
				tokenHash: this.hash(refreshToken),
				expiresAt: new Date(Date.now() + days * 86_400_000)
			}
		});

		return {
			accessToken,
			refreshToken,
			expiresIn: this.config.get('auth.accessTtl', { infer: true })
		};
	}

	async rotate(
		rawRefresh: string
	): Promise<{ user: User; tokens: IssuedTokens }> {
		const hash = this.hash(rawRefresh);
		return this.prisma.$transaction(async (tx) => {
			const record = await tx.refreshToken.findUnique({
				where: { tokenHash: hash },
				include: { user: true }
			});

			if (!record || record.revokedAt || record.expiresAt <= new Date()) {
				throw this.invalidRefresh();
			}

			const revoked = await tx.refreshToken.updateMany({
				where: { tokenHash: hash, revokedAt: null },
				data: { revokedAt: new Date() }
			});

			if (revoked.count === 0) throw this.invalidRefresh();
			return { user: record.user, tokens: await this.issue(record.user, tx) };
		});
	}

	private invalidRefresh(): BusinessException {
		return new BusinessException(
			ErrorCodes.INVALID_REFRESH_TOKEN,
			'refresh token 无效或已过期',
			HttpStatus.UNAUTHORIZED
		);
	}

	async revoke(rawRefresh: string): Promise<void> {
		await this.prisma.refreshToken.updateMany({
			where: { tokenHash: this.hash(rawRefresh), revokedAt: null },
			data: { revokedAt: new Date() }
		});
	}
}
