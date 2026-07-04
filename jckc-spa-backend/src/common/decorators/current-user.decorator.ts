import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Injects the SessionUser the global AuthGuard attached to the request.
 * `undefined` only on @Public routes (where no session is resolved).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown => {
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    return request.user;
  },
);
