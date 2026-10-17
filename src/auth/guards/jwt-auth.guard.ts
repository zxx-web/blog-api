import {
	CanActivate,
	ExecutionContext,
	HttpStatus,
	Injectable
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ErrorCodes } from 'src/common/constants/error-code';
import { BusinessException } from 'src/common/exceptions/business.exception';

export interface JwtPayload {
	sub: string;
	role: string;
	iat?: number;
	exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private readonly jwt: JwtService) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest<Request>();
		const header = req.headers.authorization;
		if (!header?.startsWith('Bearer ')) {
			throw this.unauthorized('缺少 Bearer Token');
		}
		const token = header.slice('Bearer '.length).trim();
		try {
			const payload = await this.jwt.verifyAsync<JwtPayload>(token);
			(req as Request & { user?: JwtPayload }).user = payload;
			return true;
		} catch {
			throw this.unauthorized('token 无效或过期');
		}
	}

	private unauthorized(message: string): BusinessException {
		return new BusinessException(
			ErrorCodes.UNAUTHORIZED,
			message,
			HttpStatus.UNAUTHORIZED
		);
	}
}
