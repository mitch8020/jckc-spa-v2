import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AUTH_INSTANCE } from './auth.provider';
import type { AuthInstance } from './auth.provider';
import type { RequestWithUser, SessionUser } from './session-user.type';

/**
 * Global session guard (registered via APP_GUARD in AuthModule).
 * Resolves the better-auth session from the request cookies and attaches
 * the typed user to `req.user`; @Public routes are skipped.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session?.user) {
      throw new UnauthorizedException();
    }

    request.user = session.user as unknown as SessionUser;
    return true;
  }
}
