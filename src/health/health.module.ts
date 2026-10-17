import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';

@Module({
	imports: [TerminusModule.forRoot()],
	controllers: [HealthController],
	providers: [RedisHealthIndicator]
})
export class HealthModule {}
