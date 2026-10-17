import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit
} from '@nestjs/common';
import { MailJobData } from './mail-payload';
import { ConnectionOptions, JobsOptions, Queue } from 'bullmq';
import { RedisService } from 'src/cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/config/configuration';
import { MAIL_QUEUE } from './queue.constants';

@Injectable()
export class MailQueueService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(MailQueueService.name);
	private queue?: Queue<MailJobData>;

	constructor(
		private readonly redis: RedisService,
		private readonly config: ConfigService<AppConfig, true>
	) {}

	async enqueue(mail: MailJobData, opts?: JobsOptions): Promise<void> {
		if (!this.redis.available) {
			this.logger.warn(`redis 不可用，跳过入队: ${mail.kind} -> ${mail.to}`);
			return;
		}
		try {
			await this.getQueue().add(mail.kind, mail, {
				jobId: mail.idempotencyKey,
				attempts: this.attempts,
				backoff: { type: 'exponential', delay: this.backoffMs },
				removeOnComplete: 100,
				removeOnFail: false,
				...opts
			});
		} catch (e) {
			this.logger.warn(
				`入队失败，已忽略 ${mail.kind} -> ${mail.to}: ${(e as Error).message}`
			);
		}
	}

	private getQueue(): Queue<MailJobData> {
		if (!this.queue) {
			this.queue = new Queue<MailJobData>(MAIL_QUEUE, {
				connection: this.connection
			});
			this.queue.on('error', (e) =>
				this.logger.warn(`邮件队列连接错误：${e.message}`)
			);
		}
		return this.queue;
	}

	private get connection(): ConnectionOptions {
		return this.config.get('redis.url', { infer: true });
	}

	private get attempts(): number {
		return this.config?.get('queue.attempts', { infer: true }) ?? 3;
	}

	private get backoffMs(): number {
		return this.config?.get('queue.backoffMs', { infer: true }) ?? 1000;
	}

	async onModuleInit() {
		// try {
		// 	await this.getQueue().add(
		// 		'repeat',
		// 		{
		// 			kind: 'repeat',
		// 			to: '111',
		// 			subject: '111',
		// 			body: '111',
		// 			idempotencyKey: 'repeat-test'
		// 		},
		// 		{ repeat: { key: 'repeat-test', every: 5000 } }
		// 	);
		// } catch (e) {
		// 	this.logger.warn(`入队失败，已忽略: ${(e as Error).message}`);
		// }
		// await this.getQueue().removeRepeatableByKey('repeat-test');
		// await this.getQueue().removeRepeatableByKey('repeat-key');
	}

	async onModuleDestroy(): Promise<void> {
		await this.queue?.close().catch(() => undefined);
	}
}
