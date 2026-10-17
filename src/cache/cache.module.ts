import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisLockService } from './redis-lock.service';
import { LoginAttemptService } from './login-attempt.service';

@Global()
@Module({
	providers: [RedisService, RedisLockService, LoginAttemptService],
	exports: [RedisService, RedisLockService, LoginAttemptService]
})
export class CacheModule {}
