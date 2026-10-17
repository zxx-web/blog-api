import { Global, Module } from '@nestjs/common';
import { MailQueueService } from './mail-queue.service';
import { MailProcessor } from './mail.processor';
import { MailSender } from './mail-sender';

@Global()
@Module({
	providers: [MailQueueService, MailProcessor, MailSender],
	exports: [MailQueueService]
})
export class QueueModule {}
