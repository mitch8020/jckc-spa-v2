import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthGuard } from './auth.guard';
import { AUTH_INSTANCE, authProvider } from './auth.provider';

/**
 * Hosts the better-auth instance and registers the global guards.
 * Guard order matters: AuthGuard (session -> req.user) runs before
 * RolesGuard (@Roles enforcement).
 */
@Global()
@Module({
  providers: [
    authProvider,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AUTH_INSTANCE],
})
export class AuthModule {}
