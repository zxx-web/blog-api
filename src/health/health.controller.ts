import { Controller, Get } from '@nestjs/common';
import {
	HealthCheck,
	HealthCheckService,
	PrismaHealthIndicator
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { RedisHealthIndicator } from './redis.health';
import { PrismaService } from 'src/prisma/prisma.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
	constructor(
		private readonly health: HealthCheckService,
		private readonly prisma: PrismaHealthIndicator,
		private readonly redis: RedisHealthIndicator,
		private readonly db: PrismaService
	) {}

	@Get()
	liveness() {
		return {
			status: 'ok',
			uptime: process.uptime(),
			timestamp: new Date().toISOString()
		};
	}

	@Get('ready')
	@HealthCheck()
	readiness() {
		return this.health.check([
			() => this.prisma.pingCheck('database', this.db),
			() => this.redis.pingCheck('redis')
		]);
	}
}
