import {
	Global,
	MiddlewareConsumer,
	Module,
	NestModule,
	RequestMethod
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TimingInterceptor } from './interceptors/timing.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { ValidationPipe } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ErrorCodes } from './constants/error-code';
import { ValidationError } from 'class-validator';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { CacheHeaderInterceptor } from './interceptors/cache-header.interceptor';

interface FieldError {
	field: string;
	messages: string[];
}

function flattenErrors(
	errors: ValidationError[],
	parentPath = ''
): FieldError[] {
	return errors.flatMap((error) => {
		const path = parentPath
			? `${parentPath}.${error.property}`
			: error.property;
		const own: FieldError[] = error.constraints
			? [{ field: path, messages: Object.values(error.constraints) }]
			: [];
		const children = error.children?.length
			? flattenErrors(error.children, path)
			: [];
		return [...own, ...children];
	});
}

@Global()
@Module({
	providers: [
		{ provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: CacheHeaderInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
		{
			provide: APP_PIPE,
			useFactory: () =>
				new ValidationPipe({
					transform: true,
					whitelist: true,
					forbidNonWhitelisted: true,
					transformOptions: {
						enableImplicitConversion: true
					},
					exceptionFactory: (errors) =>
						new BadRequestException({
							code: ErrorCodes.VALIDATION_ERROR,
							message: '请求参数校验失败',
							errors: flattenErrors(errors)
						})
				})
		},
		{
			provide: APP_FILTER,
			useClass: AllExceptionsFilter
		}
	]
})
export class CommonModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestContextMiddleware).forRoutes('*');

		consumer.apply(SecurityHeadersMiddleware).forRoutes('*');

		consumer
			.apply(RequestIdMiddleware, LoggerMiddleware)
			.exclude({
				path: '/health',
				method: RequestMethod.GET
			})
			.forRoutes('*');
	}
}
