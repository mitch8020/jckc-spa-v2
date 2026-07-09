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
  function makeApp() {
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'FRONTEND_ORIGIN'
          ? 'http://localhost:3000'
          : 'http://localhost:3001',
      ),
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
    return { app, auth, config, expressApp };
  }

  it('applies CORS, auth mount, body parsers, prefix, pipes and filters', () => {
    const { app, auth, config, expressApp } = makeApp();

    configureApp(app as never);

    expect(config.getOrThrow).toHaveBeenCalledWith('FRONTEND_ORIGIN');
    expect(config.getOrThrow).toHaveBeenCalledWith('BETTER_AUTH_URL');
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    });
    expect(mockToNodeHandler).toHaveBeenCalledWith(auth);
    expect(expressApp.all).toHaveBeenCalledWith('/api/auth/{*splat}', {
      auth,
    });
    expect(app.use).toHaveBeenCalledTimes(4);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(Object));
    expect(app.useGlobalFilters).toHaveBeenCalledWith(
      expect.any(GlobalExceptionFilter),
    );
  });

  it('rejects cross-site unsafe browser requests before routing', () => {
    const { app } = makeApp();
    configureApp(app as never);

    const guard = app.use.mock.calls[1][0] as (
      req: { method: string; get: (name: string) => string | undefined },
      res: { status: jest.Mock; json: jest.Mock },
      next: jest.Mock,
    ) => void;
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })), json };
    const next = jest.fn();

    guard(
      {
        method: 'POST',
        get: (name: string) =>
          name.toLowerCase() === 'origin' ? 'http://evil.test' : undefined,
      },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
