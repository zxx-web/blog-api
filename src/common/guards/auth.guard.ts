// import {
// 	CanActivate,
// 	ExecutionContext,
// 	Injectable,
// 	UnauthorizedException
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
// import { Request } from 'express';

// export interface RequestUser {
// 	id: string;
// 	roles: string[];
// }

// declare module 'express' {
// 	interface Request {
// 		user?: RequestUser;
// 	}
// }

// @Injectable()
// export class AuthGuard implements CanActivate {
// 	constructor(private readonly reflector: Reflector) {}

// 	canActivate(context: ExecutionContext): boolean {
// 		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
// 			context.getHandler(),
// 			context.getClass()
// 		]);

// 		if (isPublic) return true;

// 		const req = context.switchToHttp().getRequest<Request>();
// 		const userId = req.header('x-user');
// 		const rolesHeader = req.header('x-user-roles');

// 		if (!userId) {
// 			throw new UnauthorizedException('未登录 缺少x-user请求头');
// 		}

// 		(req as Request & { user?: any }).user = {
// 			id: userId,
// 			roles: rolesHeader
// 				? rolesHeader.split(',').map((role) => role.trim())
// 				: []
// 		};

// 		return true;
// 	}
// }
