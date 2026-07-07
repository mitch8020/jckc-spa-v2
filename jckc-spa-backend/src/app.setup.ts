import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { resolveFrontendOrigins } from './config/frontend-origins';
import { AUTH_INSTANCE } from './modules/auth/auth.provider';
import type { AuthInstance } from './modules/auth/auth.provider';

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

  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
  });

  // Mount better-auth on the raw Express instance BEFORE re-adding the
  // body parsers, so auth routes bypass both parsing and Nest routing.
  // Express 5 wildcard syntax: '{*splat}'.
  const auth = app.get<AuthInstance>(AUTH_INSTANCE);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.all('/api/auth/{*splat}', toNodeHandler(auth));

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
}
