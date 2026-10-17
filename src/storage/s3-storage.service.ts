import { Injectable, Logger } from '@nestjs/common';
import { SaveInput, StorageService, StoredFile } from './storage.service';
import {
	DeleteObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	S3ServiceException
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/config/configuration';

@Injectable()
export class S3StorageService implements StorageService {
	private readonly logger = new Logger(S3StorageService.name);
	readonly backend = 's3' as const;
	private readonly client: S3Client;
	private readonly bucket: string;
	private readonly publicBaseUrl: string | undefined;
	private readonly endpoint: string | undefined;
	private readonly forcePathStyle: boolean;

	constructor(config: ConfigService<AppConfig, true>) {
		this.bucket = config.get('storage.s3.bucket', { infer: true });
		this.endpoint =
			config.get('storage.s3.endpoint', { infer: true }) || undefined;
		this.publicBaseUrl =
			config.get('storage.s3.publicBaseUrl', { infer: true }) || undefined;
		this.forcePathStyle = config.get('storage.s3.forcePathStyle', {
			infer: true
		});

		this.client = new S3Client({
			region: config.get('storage.s3.region', { infer: true }),
			endpoint: this.endpoint,
			forcePathStyle: this.forcePathStyle,
			credentials: {
				accessKeyId: config.get('storage.s3.accessKeyId', { infer: true }),
				secretAccessKey: config.get('storage.s3.secretAccessKey', {
					infer: true
				})
			}
		});
	}

	get available(): boolean {
		return Boolean(this.bucket);
	}

	async save(input: SaveInput): Promise<StoredFile> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: input.key,
				Body: input.buffer,
				ContentType: input.contentType,
				CacheControl: 'public, max-age=31536000, immutable'
			})
		);
		return {
			key: input.key,
			url: this.publicUrl(input.key),
			size: input.buffer.length,
			contentType: input.contentType
		};
	}

	async delete(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({ Key: key, Bucket: this.bucket })
		);
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.client.send(
				new HeadObjectCommand({ Bucket: this.bucket, Key: key })
			);
			return true;
		} catch (e) {
			if (
				e instanceof S3ServiceException &&
				e.$metadata?.httpStatusCode === 404
			) {
				return false;
			}
			this.logger.warn(
				`HeadObject 失败（按不存在处理）key=${key}: ${(e as Error).message}`
			);
			return false;
		}
	}

	private base(): string {
		if (this.publicBaseUrl) return this.publicBaseUrl;
		return `${this.endpoint ?? ''}/${this.bucket}`;
	}

	publicUrl(key: string): string {
		return `${this.base()}/${key}`;
	}

	keyFromPublicUrl(url: string): string | null {
		const prefix = `${this.base()}/`;
		return url.startsWith(prefix)
			? decodeURIComponent(url.slice(prefix.length))
			: null;
	}
}
