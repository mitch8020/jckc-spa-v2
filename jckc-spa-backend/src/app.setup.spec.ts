import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { configureApp } from './app.setup';

const mockToNodeHandler = jest.fn((auth: unknown) => ({ auth }));

jest.mock('better-auth/node', () => ({
  toNodeHandler: (auth: unknown) => mockToNodeHandler(auth),
}));

jest.mock('./modules/auth/auth.provider', () => ({
  AUTH_INSTANCE: 'AUTH_INSTANCE',
}));

describe('configureApp', () => {
  it('applies CORS, auth mount, body parsers, prefix, pipes and filters', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    const auth = { api: {} };
    const expressApp = { all: jest.fn() };
    const app = {
      get: jest.fn((token: unknown) =>
        token === ConfigService ? config : auth,
      ),
      enableCors: jest.fn(),
      getHttpAdapter: jest.fn(() => ({ getInstance: () => expressApp })),
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalFilters: jest.fn(),
    };

    configureApp(app as never);

    expect(config.getOrThrow).toHaveBeenCalledWith('FRONTEND_ORIGIN');
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    });
    expect(mockToNodeHandler).toHaveBeenCalledWith(auth);
    expect(expressApp.all).toHaveBeenCalledWith('/api/auth/{*splat}', {
      auth,
    });
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(Object));
    expect(app.useGlobalFilters).toHaveBeenCalledWith(
      expect.any(GlobalExceptionFilter),
    );
  });
});
