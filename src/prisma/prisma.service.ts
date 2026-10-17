import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(PrismaService.name);
	constructor() {
		super({
			log: ['warn', 'error']
		});
	}
	async onModuleInit() {
		await this.$connect();
		this.logger.log('postgresql 连接已建立');
	}
	async onModuleDestroy() {
		await this.$disconnect();
		this.logger.log('postgresql 连接已关闭');
	}
}
