import { Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { tap } from 'rxjs/operators';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
	private readonly logger = new Logger('Timing');
	private readonly slowThreshold = 500;

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const start = Date.now();
		const req = context.switchToHttp().getRequest<Request>();
		return next.handle().pipe(
			tap({
				next: () => this.report(req, Date.now() - start)
			})
		);
	}

	private report(req: Request, duration: number) {
		if (duration > this.slowThreshold) {
			const requestId = req.headers['x-request-id'] as string | undefined;
			this.logger.warn(
				`Slow Request: ${req.method} ${req.originalUrl} ${duration}ms Request ID: ${requestId ?? '-'}`
			);
		}
	}
}
