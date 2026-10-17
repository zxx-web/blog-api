import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import helmet from 'helmet';
import { AppConfig } from 'src/config/configuration';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
	private readonly handler: ReturnType<typeof helmet>;

	constructor(config: ConfigService<AppConfig, true>) {
		const env = config.get('env', { infer: true });
		this.handler = helmet({
			contentSecurityPolicy: env === 'production',
			crossOriginResourcePolicy: { policy: 'cross-origin' }
		});
	}

	use(req: Request, res: Response, next: () => void): void {
		this.handler(req, res, next);
	}
}
