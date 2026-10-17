import {
	CanActivate,
	ExecutionContext,
	HttpStatus,
	Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Request } from 'express';
import { JwtPayload } from './jwt-auth.guard';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ErrorCodes } from 'src/common/constants/error-code';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}
	canActivate(context: ExecutionContext): boolean {
		const required = this.reflector.getAllAndOverride<string[] | undefined>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()]
		);
		if (!required || required.length === 0) return true;
		const user = context
			.switchToHttp()
			.getRequest<Request & { user?: JwtPayload }>().user;

		if (!user) {
			throw new BusinessException(
				ErrorCodes.UNAUTHORIZED,
				'未认证',
				HttpStatus.UNAUTHORIZED
			);
		}

		if (!required.includes(user.role)) {
			throw new BusinessException(
				ErrorCodes.FORBIDDEN,
				'权限不足',
				HttpStatus.FORBIDDEN
			);
		}

		return true;
	}
}
