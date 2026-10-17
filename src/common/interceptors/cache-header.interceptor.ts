import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { getRequestContext } from '../request-context';

@Injectable()
export class CacheHeaderInterceptor implements NestInterceptor {
	intercept(
		context: ExecutionContext,
		next: CallHandler<any>
	): Observable<any> | Promise<Observable<any>> {
		const res = context.switchToHttp().getResponse<Response>();
		return next.handle().pipe(
			tap(() => {
				const { cache, cacheKey } = getRequestContext();
				if (cache) {
					res.setHeader('X-Cache', cache);
					if (cacheKey) res.setHeader('X-Cache-Key', cacheKey);
				}
			})
		);
	}
}
