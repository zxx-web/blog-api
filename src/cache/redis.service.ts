import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from 'src/config/configuration';

@Injectable()
export class RedisService implements OnModuleDestroy {
	private readonly logger = new Logger(RedisService.name);
	private readonly client: Redis;
	constructor(config: ConfigService<AppConfig, true>) {
		const url = config.get('redis.url', { infer: true });
		this.client = new Redis(url, {
			maxRetriesPerRequest: 1,
			enableOfflineQueue: false
		});
		let down = false;
		this.client.on('error', (err) => {
			if (!down) {
				down = true;
				this.logger.warn(`Redis 不可用，缓存降级为直连数据库：${err.message}`);
			}
		});
		this.client.on('ready', () => {
			if (down) {
				down = false;
				this.logger.log('Redis已恢复，缓存重新生效');
			}
		});
	}

	async ping(): Promise<boolean> {
		try {
			const reply = await this.client.ping();
			return reply === 'PONG';
		} catch {
			return false;
		}
	}

	get available(): boolean {
		return this.client.status === 'ready';
	}

	async get(key: string): Promise<string | null> {
		try {
			return this.client.get(key);
		} catch (e) {
			this.debugMiss(key, e);
			return null;
		}
	}

	async set(key: string, value: string, ttlSeconds: number): Promise<void> {
		try {
			await this.client.set(key, value, 'EX', ttlSeconds);
		} catch (e) {
			this.debugMiss(key, e);
		}
	}

	async del(key: string): Promise<void> {
		try {
			await this.client.del(key);
		} catch (e) {
			this.debugMiss(key, e);
		}
	}

	async setNx(
		key: string,
		value: string,
		ttlSeconds: number
	): Promise<boolean> {
		try {
			const res = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
			return res === 'OK';
		} catch (e) {
			this.debugMiss(key, e);
			return false;
		}
	}

	async eval(
		script: string,
		keys: string[],
		args: (string | number)[]
	): Promise<unknown> {
		try {
			return this.client.eval(script, keys.length, ...keys, ...args);
		} catch (e) {
			this.debugMiss(keys.join(','), e);
			return null;
		}
	}

	async zincrby(key: string, incr: number, member: string): Promise<void> {
		try {
			await this.client.zincrby(key, incr, member);
		} catch (e) {
			this.debugMiss(key, e);
		}
	}

	async zrem(key: string, member: string): Promise<void> {
		try {
			await this.client.zrem(key, member);
		} catch (e) {
			this.debugMiss(key, e);
		}
	}

	async zrevrangeWithScores(
		key: string,
		start: number,
		stop: number
	): Promise<Array<{ member: string; score: number }>> {
		try {
			const flat = await this.client.zrevrange(key, start, stop, 'WITHSCORES');
			const out: Array<{ member: string; score: number }> = [];
			for (let i = 0; i < flat.length; i += 2) {
				out.push({ member: flat[i], score: +flat[i + 1] });
			}
			return out;
		} catch (e) {
			this.debugMiss(key, e);
			return [];
		}
	}

	async delByPrefix(prefix: string): Promise<number> {
		let cursor = '0';
		let deleted = 0;
		try {
			do {
				const [next, keys] = await this.client.scan(
					cursor,
					'MATCH',
					`${prefix}*`,
					'COUNT',
					100
				);
				cursor = next;
				if (keys.length > 0) {
					deleted += await this.client.del(...keys);
				}
			} while (cursor !== '0');
			return deleted;
		} catch (e) {
			this.debugMiss(prefix, e);
			return 0;
		}
	}

	async incrWithTtl(key: string, ttl: number): Promise<number> {
		const script = `
			local n = redis.call('INCR', KEYS[1])
			if(n ===1 ) redis.call('EXPIRE', KEYS[1], ARGV[1]) END
			RETURN n
		`;
		try {
			const n = await this.client.eval(script, 1, key, ttl);
			return typeof n === 'number' ? n : 0;
		} catch (e) {
			this.debugMiss(key, e);
			return 0;
		}
	}

	private debugMiss(key: string, e: unknown): void {
		this.logger.debug(
			`缓存操作失败 (已降级) key=${key} err=${(e as Error).message}`
		);
	}

	async onModuleDestroy(): Promise<void> {
		this.client.quit().catch(() => undefined);
	}
}
