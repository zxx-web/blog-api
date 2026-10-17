import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/cache/redis.service';
import { AppConfig } from 'src/config/configuration';
import { MailJobData } from './mail-payload';
import { MAIL_SENT_PREFIX } from './queue.constants';
import nodeMailer from 'nodemailer';
import type { Mail, SMTPSentMessageInfo } from 'nodemailer';

@Injectable()
export class MailSender {
	private readonly logger = new Logger(MailSender.name);
	readonly deliverdCount = new Map<string, number>();
	private transporter?: Mail<SMTPSentMessageInfo>;

	constructor(
		private readonly redis: RedisService,
		private readonly config: ConfigService<AppConfig, true>
	) {}

	async send(mail: MailJobData): Promise<boolean> {
		const sendKey = `${MAIL_SENT_PREFIX}${mail.idempotencyKey}`;

		const mine = await this.redis.setNx(sendKey, '1', this.sentTtl);
		if (!mine) {
			this.logger.debug(`幂等重复，跳过重复发送: ${mail.kind} ${mail.to}`);
			return false;
		}

		try {
			await this.simulateSmtp(mail);
			this.deliverdCount.set(
				mail.idempotencyKey,
				(this.deliverdCount.get(mail.idempotencyKey) ?? 0) + 1
			);
			this.logger.log(`已发送：${mail.kind} -> ${mail.to}: ${mail.subject}`);
			return true;
		} catch (e) {
			await this.redis.del(sendKey);
			throw e;
		}
	}

	private async simulateSmtp(mail: MailJobData): Promise<void> {
		if (mail.to.endsWith('@fail.test')) {
			throw new Error(`模拟SMTP错误: ${mail.to}`);
		}
		// 正常情况
		if (!this.smtpUser || !this.smtpPass) {
			this.logger.warn(
				`SMTP用户或授权码未配置, 跳过发送邮件: ${mail.kind} -> ${mail.to} `
			);
			return;
		}
		await this.getTransporter().verify();
		await this.getTransporter().sendMail({
			from: `"Example Team" <${this.smtpUser}>`, // sender address
			to: mail.to, // list of recipients
			subject: mail.subject, // subject line
			text: mail.body // plain text body
		});
	}

	private getTransporter(): Mail<SMTPSentMessageInfo> {
		if (!this.transporter) {
			this.transporter = nodeMailer.createTransport({
				host: 'smtp.qq.com',
				port: 587,
				secure: false,
				auth: {
					user: this.smtpUser,
					pass: this.smtpPass
				}
			});
		}
		return this.transporter;
	}

	private get sentTtl(): number {
		return this.config.get('queue.sentTtlSec', { infer: true }) ?? 86400;
	}

	private get smtpUser(): string {
		return this.config.get('smtp.user', { infer: true });
	}

	private get smtpPass(): string {
		return this.config.get('smtp.pass', { infer: true });
	}
}
