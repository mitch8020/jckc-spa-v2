describe('bootstrap', () => {
  async function importMainWithPort(port: string | undefined) {
    jest.resetModules();

    const config = { get: jest.fn().mockReturnValue(port) };
    const app = {
      get: jest.fn().mockReturnValue(config),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    const create = jest.fn().mockResolvedValue(app);
    const configureApp = jest.fn();

    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create },
    }));
    jest.doMock('@nestjs/config', () => ({
      ConfigService: class ConfigService {},
    }));
    jest.doMock('./app.module', () => ({
      AppModule: class AppModule {},
    }));
    jest.doMock('./app.setup', () => ({
      configureApp,
    }));

    jest.isolateModules(() => {
      jest.requireActual('./main');
    });
    await Promise.resolve();
    await Promise.resolve();

    return { app, config, create, configureApp };
  }

  it('creates the Nest app with body parsing disabled and listens on configured PORT', async () => {
    const { app, config, create, configureApp } =
      await importMainWithPort('4000');

    expect(create).toHaveBeenCalledWith(expect.any(Function), {
      bodyParser: false,
    });
    expect(configureApp).toHaveBeenCalledWith(app);
    expect(config.get).toHaveBeenCalledWith('PORT');
    expect(app.listen).toHaveBeenCalledWith('4000');
  });

  it('defaults to port 3001 when PORT is unset', async () => {
    const { app } = await importMainWithPort(undefined);

    expect(app.listen).toHaveBeenCalledWith(3001);
  });
});
