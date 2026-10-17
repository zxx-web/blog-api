import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-code';

export class BusinessException extends HttpException {
	constructor(
		public readonly bizCode: ErrorCode,
		message: string,
		httpStatus: HttpStatus = HttpStatus.BAD_REQUEST
	) {
		super({ code: bizCode, message }, httpStatus);
	}
}
