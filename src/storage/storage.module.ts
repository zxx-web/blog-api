import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { CoverUploadInterceptor } from './cover-upload.interceptor';
import { ImageProcessorService } from './image-processor.service';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { STORAGE_SERVICE } from './storage.constants';
import type { StorageService } from './storage.service';

@Global()
@Module({
	imports: [ConfigModule],
	providers: [
		ImageProcessorService,
		CoverUploadInterceptor,
		{
			provide: STORAGE_SERVICE,
			inject: [ConfigService],
			useFactory: (config: ConfigService<AppConfig, true>): StorageService => {
				const backend = config.get('storage.backend', { infer: true });
				if (backend === 's3') {
					if (!config.get('storage.s3.bucket', { infer: true })) {
						throw new Error(
							'STORAGE_BACKEND=s3 但未配置 S3_BUCKET——选了对象存储就配齐，别让请求打到一半才发现没有 bucket'
						);
					}
					return new S3StorageService(config);
				}
				return new LocalStorageService(config);
			}
		}
	],
	exports: [STORAGE_SERVICE, ImageProcessorService, CoverUploadInterceptor]
})
export class StorageModule {}
