import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  // bodyParser disabled globally: better-auth must receive the raw
  // request stream on /api/auth/* (DESIGN.md "Auth" section).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  configureApp(app);

  const config = app.get(ConfigService);
  await app.listen(config.get<string>('PORT') ?? 3001);
}

void bootstrap();
