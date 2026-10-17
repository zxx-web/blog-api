import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/cache/redis.service';

@Injectable()
export class TrendingService {
	static readonly KEY = 'hot:posts';

	constructor(private readonly redis: RedisService) {}

	async bump(postId: string): Promise<void> {
		if (!this.redis.available) return;
		await this.redis.zincrby(TrendingService.KEY, 1, postId);
	}

	async drop(postId: string): Promise<void> {
		if (!this.redis.available) return;
		await this.redis.zrem(TrendingService.KEY, postId);
	}

	async top(limit: number): Promise<Array<{ id: string; score: number }>> {
		if (!this.redis.available || limit <= 0) return [];
		const rows = await this.redis.zrevrangeWithScores(
			TrendingService.KEY,
			0,
			limit - 1
		);
		return rows.map((r) => ({ id: r.member, score: r.score }));
	}
}
