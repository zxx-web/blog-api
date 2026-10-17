import { Injectable } from '@nestjs/common';
import {
	HealthCheckError,
	HealthIndicator,
	HealthIndicatorResult
} from '@nestjs/terminus';
import { RedisService } from 'src/cache/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
	constructor(private readonly redis: RedisService) {
		super();
	}

	async pingCheck(key: string): Promise<HealthIndicatorResult> {
		const isHealthy = await this.redis.ping();
		if (isHealthy) {
			return this.getStatus(key, true);
		}
		throw new HealthCheckError(
			`${key} is not available`,
			this.getStatus(key, false)
		);
	}
}
