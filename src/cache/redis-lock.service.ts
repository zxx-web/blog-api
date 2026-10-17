import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RedisLockService {
	private static readonly RELEASE_SCRIPT = `
		if redis.call('GET', KEYS[1]) == ARGV[1] then
			return redis.call('DEL', KEYS[1])
		else
			return 0
		end 
	`;

	constructor(private readonly redis: RedisService) {}

	async acquire(key: string, ttlSeconds: number): Promise<string | null> {
		if (!this.redis.available) return null;
		const token = randomUUID();
		const ok = await this.redis.setNx(key, token, ttlSeconds);
		return ok ? token : null;
	}

	async release(key: string, token: string): Promise<void> {
		await this.redis.eval(RedisLockService.RELEASE_SCRIPT, [key], [token]);
	}

	async withLock<T>(
		key: string,
		ttlSeconds: number,
		fn: () => Promise<T>
	): Promise<T | undefined> {
		const token = await this.acquire(key, ttlSeconds);
		if (token === null) return undefined;
		try {
			return await fn();
		} finally {
			await this.release(key, token);
		}
	}
}
