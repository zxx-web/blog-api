import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode, ErrorCodes } from '../constants/error-code';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger('Exception');

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const req = ctx.getRequest<Request>();
		const res = ctx.getResponse<Response>();

		const isHttp = exception instanceof HttpException;

		let status = isHttp
			? exception.getStatus()
			: HttpStatus.INTERNAL_SERVER_ERROR;

		const raw = isHttp ? exception.getResponse() : null;
		const payload: Record<string, any> =
			typeof raw === 'string' ? { message: raw } : (raw ?? {});

		if (status === HttpStatus.TOO_MANY_REQUESTS) {
			payload.code = ErrorCodes.RATE_LIMITED;
			payload.message = '请求过于频繁，请稍后再试';
		}

		if (!isHttp && isPayloadTooLarge(exception)) {
			status = HttpStatus.PAYLOAD_TOO_LARGE;
			payload.code = ErrorCodes.BODY_TOO_LARGE;
			payload.message = '请求体过大，请减小提交内容';
		}

		if (!isHttp && status >= 500) {
			this.logger.error(
				`${req.method} ${req.url} -> 500`,
				exception instanceof Error ? exception.stack : String(exception)
			);
		} else if (status >= 500) {
			this.logger.error(
				`${req.method} ${req.url} -> ${status}`,
				JSON.stringify(payload)
			);
		}

		const requestId = req.headers['x-request-id'] || undefined;

		res.status(status).json({
			code: (payload as { code?: ErrorCode }).code ?? status,
			data: null,
			message: isHttp
				? Array.isArray((payload as { message?: string[] }).message)
					? (payload as { message?: string[] }).message?.join('; ')
					: ((payload as { message?: string }).message ?? 'request failed')
				: '服务器内部错误',
			errors: (payload as { errors?: unknown }).errors,
			path: req.url,
			requestId,
			timestamp: new Date().toISOString()
		});
	}
}

function isPayloadTooLarge(exception: unknown): boolean {
	const e = exception as {
		type?: string;
		status?: number;
		statusCode?: number;
	};
	return (
		e?.type === 'entity.too.large' ||
		e?.status === HttpStatus.PAYLOAD_TOO_LARGE ||
		e?.statusCode === HttpStatus.PAYLOAD_TOO_LARGE
	);
}
