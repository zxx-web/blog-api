import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit
} from '@nestjs/common';
import { ConnectionOptions, Job, Queue, Worker } from 'bullmq';
import { MailJobData } from './mail-payload';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/config/configuration';
import { MailSender } from './mail-sender';
import { MAIL_DEAD_LETTER, MAIL_QUEUE } from './queue.constants';

@Injectable()
export class MailProcessor implements OnModuleDestroy, OnModuleInit {
	private readonly logger = new Logger(MailProcessor.name);
	private worker?: Worker<MailJobData>;

	private dlq?: Queue<MailJobData>;

	constructor(
		private readonly config: ConfigService<AppConfig, true>,
		private readonly sender: MailSender
	) {}

	onModuleInit(): void {
		this.dlq = new Queue<MailJobData>(MAIL_DEAD_LETTER, {
			connection: this.connection
		});
		this.dlq.on('error', (e) =>
			this.logger.warn(`死信队列连接错误：${e.message}`)
		);
		this.worker = new Worker<MailJobData>(
			MAIL_QUEUE,
			async (job: Job<MailJobData>) => {
				if (job.name === 'repeat') {
					console.log(job.id);
				} else {
					await this.sender.send(job.data);
				}
			},
			{ connection: this.connection, concurrency: this.concurrency }
		);
		this.worker.on('completed', (job) =>
			this.logger.debug(`邮件任务完成：${job.data.kind} -> ${job.data.to}`)
		);

		this.worker.on('failed', (job, err) => {
			(async () => {
				if (!job) return;
				const maxAttempts = job.opts.attempts ?? 1;
				if (job.attemptsMade >= maxAttempts) {
					await this.dlq
						?.add(job.name, job.data, { jobId: job.id })
						.catch((e: Error) =>
							this.logger.error(`转死信失败 ${job?.data.to}：${e.message}`)
						);
					this.logger.error(
						`邮件重试 ${maxAttempts} 次仍失败，转入死信队列：${job.data.to}（${err.message}）`
					);
				} else {
					this.logger.warn(
						`邮件第 ${job.attemptsMade}/${maxAttempts} 次失败，将退避重试：${job.data.to}（${err.message}）`
					);
				}
			})().catch(() => undefined);
		});

		this.worker.on('error', (e) =>
			this.logger.warn(`邮件 worker 连接错误：${e.message}`)
		);
	}

	async onModuleDestroy(): Promise<void> {
		// 先停 worker（不再拉新任务、等当前任务收尾），再关队列连接。close 连不上时可能 reject，吞掉。
		await this.worker?.close().catch(() => undefined);
		await this.dlq?.close().catch(() => undefined);
	}

	private get connection(): ConnectionOptions {
		return { url: this.config.get('redis.url', { infer: true }) };
	}

	private get concurrency(): number {
		return this.config?.get('queue.concurrency', { infer: true }) ?? 4;
	}
}
