import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { resolveAuthBaseURL } from './config/auth-base-url';
import { resolveFrontendOrigins } from './config/frontend-origins';
import { AUTH_INSTANCE } from './modules/auth/auth.provider';
import type { AuthInstance } from './modules/auth/auth.provider';
import { mountFrontend } from './frontend.setup';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function resolveAllowedUnsafeOrigins(
  frontendOrigins: string[],
  authBaseUrl: ReturnType<typeof resolveAuthBaseURL>,
): ReadonlySet<string> {
  const authOrigins =
    typeof authBaseUrl === 'string'
      ? [new URL(authBaseUrl).origin]
      : [
          new URL(authBaseUrl.fallback).origin,
          ...authBaseUrl.allowedHosts.map((host) => {
            const protocol =
              authBaseUrl.protocol === 'auto'
                ? new URL(authBaseUrl.fallback).protocol.slice(0, -1)
                : authBaseUrl.protocol;
            return new URL(`${protocol}://${host}`).origin;
          }),
        ];

  return new Set([...frontendOrigins, ...authOrigins]);
}

function csrfOriginGuard(allowedOrigins: ReadonlySet<string>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    if (req.get('sec-fetch-site') === 'cross-site') {
      res.status(403).json({ statusCode: 403, message: 'Forbidden' });
      return;
    }

    const origin = req.get('origin');
    if (origin) {
      if (!allowedOrigins.has(origin)) {
        res.status(403).json({ statusCode: 403, message: 'Forbidden' });
        return;
      }
      next();
      return;
    }

    const referer = req.get('referer');
    if (referer) {
      try {
        if (!allowedOrigins.has(new URL(referer).origin)) {
          res.status(403).json({ statusCode: 403, message: 'Forbidden' });
          return;
        }
      } catch {
        res.status(403).json({ statusCode: 403, message: 'Forbidden' });
        return;
      }
    }

    next();
  };
}

/**
 * Applies the full HTTP wiring to an app created with `bodyParser: false`:
 * CORS, the better-auth mount, JSON/urlencoded body parsing, the global
 * /api prefix, the ValidationPipe and the GlobalExceptionFilter.
 *
 * Shared between main.ts and the e2e suite so tests run against the exact
 * production configuration (DESIGN.md "Auth" section).
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const frontendOrigins = resolveFrontendOrigins(
    config.getOrThrow<string>('FRONTEND_ORIGIN'),
  );
  const authBaseUrl = resolveAuthBaseURL(
    config.getOrThrow<string>('BETTER_AUTH_URL'),
  );

  app.use(helmet());
  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
  });

  // Mount better-auth on the raw Express instance BEFORE re-adding the
  // body parsers, so auth routes bypass both parsing and Nest routing.
  // Express 5 wildcard syntax: '{*splat}'.
  const auth = app.get<AuthInstance>(AUTH_INSTANCE);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  app.use(
    csrfOriginGuard(resolveAllowedUnsafeOrigins(frontendOrigins, authBaseUrl)),
  );
  expressApp.all('/api/auth/{*splat}', toNodeHandler(auth));
  mountFrontend(expressApp);

  app.use(express.json({ limit: '100kb' }));
  app.use(
    express.urlencoded({ extended: false, limit: '25kb', parameterLimit: 100 }),
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
}
