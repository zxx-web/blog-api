import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { ErrorCodes } from 'src/common/constants/error-code';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { AppConfig } from 'src/config/configuration';
import { MIME_TO_EXT } from './storage.constants';

export interface ProcessedImage {
	buffer: Buffer;
	contentType: string;
	ext: string;
	width: number;
	height: number;
	format: string;
}

@Injectable()
export class ImageProcessorService {
	private readonly logger = new Logger(ImageProcessorService.name);

	constructor(private readonly config: ConfigService<AppConfig, true>) {}

	async processCover(buffer: Buffer): Promise<ProcessedImage> {
		const meta = await sharp(buffer)
			.metadata()
			.catch(() => null);

		if (!meta || !meta.width || !meta.height) {
			throw new BusinessException(
				ErrorCodes.INVALID_FILE,
				'文件不是合法图片或已损坏',
				HttpStatus.UNPROCESSABLE_ENTITY
			);
		}

		const maxWidth = this.config.get('storage.cover.maxWidth', { infer: true });
		const format = this.config.get('storage.cover.format', { infer: true });

		const { data, info } = await sharp(buffer)
			.rotate()
			.resize({ width: maxWidth, withoutEnlargement: true })
			.toFormat(format, { quality: 82 })
			.toBuffer({ resolveWithObject: true });

		const contentType = `image/${info.format}`;

		const ext = MIME_TO_EXT[contentType] ?? info.format;
		this.logger.debug(
			`封面处理：${meta.width}×${meta.height} ${meta.format} → ${info.width}×${info.height} ${info.format} (${buffer.length}→${data.length}B)`
		);
		return {
			buffer: data,
			contentType,
			ext,
			width: info.width,
			height: info.height,
			format: info.format
		};
	}
}
