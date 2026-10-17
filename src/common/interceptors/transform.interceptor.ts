import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
	code: 0;
	data: T;
	message: 'ok';
	requestId?: string;
	timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
	T,
	ApiResponse<T>
> {
	intercept(
		_context: ExecutionContext,
		next: CallHandler<T>
	): Observable<ApiResponse<T>> {
		const req = _context.switchToHttp().getRequest<Request>();
		return next.handle().pipe(
			map((data) => ({
				code: 0,
				data,
				message: 'ok',
				requestId: req.headers['x-request-id'] as string | undefined,
				timestamp: new Date().toISOString()
			}))
		);
	}
}
