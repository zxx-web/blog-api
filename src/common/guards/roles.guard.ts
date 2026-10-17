// import {
// 	CanActivate,
// 	ExecutionContext,
// 	ForbiddenException,
// 	Injectable
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { ROLES_KEY } from '../decorators/roles.decorator';
// import { Request } from 'express';

// @Injectable()
// export class RolesGuard implements CanActivate {
// 	constructor(private readonly reflector: Reflector) {}

// 	canActivate(context: ExecutionContext): boolean {
// 		const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
// 			context.getHandler(),
// 			context.getClass()
// 		]);

// 		if (!required || required.length === 0) return true;

// 		const req = context.switchToHttp().getRequest<Request>();
// 		const user = req.user;

// 		if (!user) {
// 			throw new ForbiddenException('用户信息缺失');
// 		}

// 		const ok = required.some((role) => user.roles.includes(role));

// 		if (!ok) {
// 			throw new ForbiddenException(
// 				`需要一下角色之一：[${required.join(', ')}], 当前：[${user.roles.join(', ')}]`
// 			);
// 		}

// 		return true;
// 	}
// }
