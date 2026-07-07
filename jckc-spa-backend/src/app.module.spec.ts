const mockConfigForRoot = jest.fn((options: unknown) => ({
  module: class MockConfigModule {},
  options,
}));
const mockForRootAsync = jest.fn((options: unknown) => ({
  module: class MockMongooseRootModule {},
  options,
}));
const mockConfigureMongoSrvDns = jest.fn();

type MongooseRootOptions = {
  useFactory: (config: {
    getOrThrow: (key: string) => string;
    get: (key: string) => string | undefined;
  }) => Promise<{ uri: string }>;
};

jest.mock('@nestjs/config', () => ({
  ConfigModule: { forRoot: (options: unknown) => mockConfigForRoot(options) },
  ConfigService: class ConfigService {},
}));

jest.mock('@nestjs/mongoose', () => ({
  MongooseModule: {
    forRootAsync: (options: unknown) => mockForRootAsync(options),
  },
}));

jest.mock('./config/mongo-dns', () => ({
  configureMongoSrvDns: (...args: unknown[]) => {
    mockConfigureMongoSrvDns(...args);
  },
}));

jest.mock('./modules/auth/auth.module', () => ({
  AuthModule: class AuthModule {},
}));
jest.mock('./modules/classrooms/classrooms.module', () => ({
  ClassroomsModule: class ClassroomsModule {},
}));
jest.mock('./modules/dashboard/dashboard.module', () => ({
  DashboardModule: class DashboardModule {},
}));
jest.mock('./modules/guardians/guardians.module', () => ({
  GuardiansModule: class GuardiansModule {},
}));
jest.mock('./modules/health/health.module', () => ({
  HealthModule: class HealthModule {},
}));
jest.mock('./modules/reports/reports.module', () => ({
  ReportsModule: class ReportsModule {},
}));
jest.mock('./modules/students/students.module', () => ({
  StudentsModule: class StudentsModule {},
}));
jest.mock('./modules/users/users.module', () => ({
  UsersModule: class UsersModule {},
}));

describe('AppModule', () => {
  it('configures environment validation and mongoose DNS setup', async () => {
    jest.requireActual('./app.module');

    const [configOptions] = mockConfigForRoot.mock.calls[0] as [
      { isGlobal: boolean; validate: unknown },
    ];
    expect(configOptions.isGlobal).toBe(true);
    expect(typeof configOptions.validate).toBe('function');

    const [mongooseOptions] = mockForRootAsync.mock.calls[0] as [
      MongooseRootOptions & { inject: unknown[] },
    ];
    expect(mongooseOptions.inject).toHaveLength(1);
    expect(typeof mongooseOptions.useFactory).toBe('function');
    await expect(
      mongooseOptions.useFactory({
        getOrThrow: () => 'mongodb+srv://cluster/db',
        get: () => '1.1.1.1,8.8.8.8',
      }),
    ).resolves.toEqual({ uri: 'mongodb+srv://cluster/db' });
    expect(mockConfigureMongoSrvDns).toHaveBeenCalledWith(
      'mongodb+srv://cluster/db',
      '1.1.1.1,8.8.8.8',
    );
  });
});
