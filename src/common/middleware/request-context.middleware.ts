import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from '../request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	use(_req: Request, _res: Response, next: NextFunction): void {
		requestContextStorage.run({}, () => next());
	}
}
