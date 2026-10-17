import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/config/configuration';

export interface AttemptResult {
	attempts: number;
	locked: boolean;
}

@Injectable()
export class LoginAttemptService {
	private readonly maxAttempts: number;
	private readonly windowSec: number;

	constructor(
		private readonly redis: RedisService,
		private readonly config: ConfigService<AppConfig, true>
	) {
		this.maxAttempts = this.config.get('auth.lockout.maxAttempts', {
			infer: true
		});
		this.windowSec = this.config.get('auth.lockout.windowSec', {
			infer: true
		});
	}

	private key(email: string): string {
		return `loginfail:${email.trim().toLowerCase()}`;
	}

	private get enabled(): boolean {
		return this.redis.available;
	}

	async isLocked(email: string): Promise<boolean> {
		if (!this.enabled) return false;
		const raw = await this.redis.get(this.key(email));
		const n = Number(raw);
		return Number.isInteger(n) && n >= this.maxAttempts;
	}

	async recordFailure(email: string): Promise<AttemptResult> {
		if (!this.enabled) return { attempts: 0, locked: false };
		const attempts = await this.redis.incrWithTtl(
			this.key(email),
			this.windowSec
		);
		return { attempts, locked: attempts >= this.maxAttempts };
	}

	async clear(email: string): Promise<void> {
		if (!this.enabled) return;
		await this.redis.del(this.key(email));
	}
}
