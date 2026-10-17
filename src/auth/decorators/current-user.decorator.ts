import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../guards/jwt-auth.guard';

export const currentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): JwtPayload =>
		ctx.switchToHttp().getRequest().user
);
