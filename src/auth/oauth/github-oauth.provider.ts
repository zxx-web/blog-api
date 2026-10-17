import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from 'src/common/constants/error-code';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { AppConfig } from 'src/config/configuration';

export interface GithubUser {
	id: string; // GitHub 数字 id（转成字符串）
	login: string; // GitHub 用户名
	name: string | null;
	email: string | null;
}

@Injectable()
export class GithubOauthProvider {
	constructor(private readonly config: ConfigService<AppConfig, true>) {}

	private cfg() {
		return this.config.get('oauth.github', { infer: true });
	}

	isConfigured(): boolean {
		const c = this.cfg();
		return Boolean(c.clientId && c.clientSecret);
	}

	getAuthorizeUrl(state: string): string {
		const c = this.cfg();
		const params = new URLSearchParams({
			client_id: c.clientId ?? '',
			redirect_uri: c.callbackUrl,
			scope: 'read:user user:email',
			state,
			allow_signup: 'true'
		});
		return `https://github.com/login/oauth/authorize?${params.toString()}`;
	}

	async exchangeCodeToToken(code: string): Promise<string> {
		const c = this.cfg();
		const res = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				client_id: c.clientId,
				client_secret: c.clientSecret,
				redirect_uri: c.callbackUrl,
				code
			})
		});

		const data = (await res.json()) as {
			access_token?: string;
			error?: string;
		};

		if (!data.access_token) {
			throw new BusinessException(
				ErrorCodes.OAUTH_FAILED,
				'github授权码换取token失败',
				HttpStatus.UNAUTHORIZED
			);
		}

		return data.access_token;
	}

	async fetchGithubUser(githubToken: string): Promise<GithubUser> {
		const headers = {
			Authorization: `Bearer ${githubToken}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'blog-api'
		};

		const userRes = await fetch('https://api.github.com/user', { headers });

		if (!userRes.ok) {
			throw new BusinessException(
				ErrorCodes.OAUTH_FAILED,
				'github拉取用户信息失败',
				HttpStatus.UNAUTHORIZED
			);
		}

		const u = (await userRes.json()) as {
			id: number;
			login: string;
			name: string | null;
			email: string | null;
		};

		let email = u.email;

		if (!email) {
			const emailRes = await fetch('https://api.github.com/user/emails', {
				headers
			});
			if (emailRes.ok) {
				const emails = (await emailRes.json()) as Array<{
					email: string;
					primary: boolean;
					verified: boolean;
				}>;
				email =
					emails.find((e) => e.primary && e.verified)?.email ??
					emails.find((e) => e.verified)?.email ??
					null;
			}
		}
		return { id: String(u.id), login: u.login, name: u.name, email };
	}
}
