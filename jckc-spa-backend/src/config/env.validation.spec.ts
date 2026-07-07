import { validate } from './env.validation';

describe('validate', () => {
  const completeConfig = {
    MONGO_URI: 'mongodb://localhost/jckc',
    BETTER_AUTH_SECRET: 'secret',
    BETTER_AUTH_URL: 'http://localhost:3001',
    FRONTEND_ORIGIN: 'http://localhost:3000',
  };

  it('returns the original config when all required values are present', () => {
    expect(validate(completeConfig)).toBe(completeConfig);
  });

  it('treats undefined, null and blank strings as missing', () => {
    expect(() =>
      validate({
        MONGO_URI: undefined,
        BETTER_AUTH_SECRET: null,
        BETTER_AUTH_URL: '   ',
        FRONTEND_ORIGIN: 'http://localhost:3000',
      }),
    ).toThrow(
      'Missing required environment variable(s): MONGO_URI, BETTER_AUTH_SECRET, BETTER_AUTH_URL',
    );
  });
});
