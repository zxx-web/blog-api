import { Module } from '@nestjs/common';
import { PostsModule } from './posts/posts.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from './config/config.validation';
import { AppConfig, configuration } from './config/configuration';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			validate: (raw) => {
				const env = validateEnv(raw);
				return configuration(env);
			}
		}),
		ThrottlerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<AppConfig, true>) => [
				{
					ttl: config.get('rateLimit.ttlMs', { infer: true }),
					limit: config.get('rateLimit.limit', { infer: true })
				}
			]
		}),
		CommonModule,
		PrismaModule,
		CacheModule,
		QueueModule,
		HealthModule,
		AuthModule,
		PostsModule,
		StorageModule
	],
	providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
