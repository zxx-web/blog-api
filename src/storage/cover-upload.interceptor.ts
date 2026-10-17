import {
	CallHandler,
	ExecutionContext,
	HttpStatus,
	Injectable,
	NestInterceptor
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { AppConfig } from 'src/config/configuration';
import multer from 'multer';
import { ALLOWED_IMAGE_MIME } from './storage.constants';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ErrorCodes } from 'src/common/constants/error-code';
import { MulterError } from 'multer';
import { Request, Response } from 'express';

const ERR_UNSUPPORTED = 'UNSUPPORTED_IMAGE';

@Injectable()
export class CoverUploadInterceptor implements NestInterceptor {
	constructor(private readonly config: ConfigService<AppConfig, true>) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler<any>
	): Observable<any> {
		const req = context.switchToHttp().getRequest<Request>();
		const res = context.switchToHttp().getResponse<Response>();
		const upload = multer({
			storage: multer.memoryStorage(),
			limits: { fileSize: this.maxBytes },
			fileFilter: (
				_req: unknown,
				file: Express.Multer.File,
				cb: (err: unknown, ok?: boolean) => void
			) => {
				if (ALLOWED_IMAGE_MIME.has(file.mimetype)) cb(null, true);
				else cb(new Error(ERR_UNSUPPORTED));
			}
		}).single('file');

		return new Observable<unknown>((subscriber) => {
			upload(req, res, (err) => {
				if (err) {
					subscriber.error(this.toBizError(err));
					return;
				}
				next.handle().subscribe(subscriber);
			});
		});
	}

	private toBizError(err: unknown): BusinessException {
		if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
			return new BusinessException(
				ErrorCodes.UPLOAD_TOO_LARGE,
				`文件过大，单文件上限 ${this.humanSize(this.maxBytes)}`,
				HttpStatus.PAYLOAD_TOO_LARGE
			);
		}
		if (err instanceof Error && err.message === ERR_UNSUPPORTED) {
			return new BusinessException(
				ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
				'仅支持 jpeg / png / webp / gif / avif 图片',
				HttpStatus.UNSUPPORTED_MEDIA_TYPE
			);
		}
		return new BusinessException(
			ErrorCodes.VALIDATION_ERROR,
			(err as Error)?.message ?? '文件上传失败',
			HttpStatus.BAD_REQUEST
		);
	}

	private get maxBytes(): number {
		return this.config.get('storage.upload.maxBytes', { infer: true });
	}

	private humanSize(bytes: number): string {
		if (bytes >= 1024 * 1024)
			return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MiB`;
		if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
		return `${bytes} B`;
	}
}
