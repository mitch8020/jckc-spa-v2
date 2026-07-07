const mockForFeature = jest.fn((models: unknown[]) => ({
  module: class MockMongooseFeatureModule {},
  models,
}));

jest.mock('@nestjs/mongoose', () => ({
  InjectModel: () => () => undefined,
  MongooseModule: {
    forFeature: (models: unknown[]) => mockForFeature(models),
  },
  Prop: () => () => undefined,
  Schema: () => () => undefined,
  SchemaFactory: { createForClass: jest.fn(() => ({})) },
}));

jest.mock('./auth/auth.guard', () => ({ AuthGuard: class AuthGuard {} }));
jest.mock('../common/guards/roles.guard', () => ({
  RolesGuard: class RolesGuard {},
}));
jest.mock('./auth/auth.provider', () => ({
  AUTH_INSTANCE: 'AUTH_INSTANCE',
  authProvider: { provide: 'AUTH_INSTANCE', useValue: {} },
}));
jest.mock('./reports/reports.service', () => ({
  ReportsService: class ReportsService {},
}));

describe('feature modules', () => {
  it('loads all feature modules and registers mongoose models where needed', () => {
    jest.requireActual('./auth/auth.module');
    jest.requireActual('./classrooms/classrooms.module');
    jest.requireActual('./dashboard/dashboard.module');
    jest.requireActual('./guardians/guardians.module');
    jest.requireActual('./health/health.module');
    jest.requireActual('./reports/reports.module');
    jest.requireActual('./students/students.module');
    jest.requireActual('./users/users.module');

    expect(mockForFeature).toHaveBeenCalled();
  });
});
