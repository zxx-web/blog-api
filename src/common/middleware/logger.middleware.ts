import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
	private readonly logger = new Logger('HTTP');

	use(req: Request, res: Response, next: NextFunction) {
		const start = Date.now();
		const requestId = req.headers['x-request-id'] as string | undefined;

		res.on('finish', () => {
			const ms = Date.now() - start;
			const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(2)}ms - ${requestId ?? '-'}`;
			if (res.statusCode >= 500) {
				this.logger.error(line);
			} else if (res.statusCode >= 400) {
				this.logger.warn(line);
			} else {
				this.logger.log(line);
			}
		});

		next();
	}
}
