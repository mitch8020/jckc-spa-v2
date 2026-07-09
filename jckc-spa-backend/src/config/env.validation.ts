const REQUIRED_VARS = [
  'MONGO_URI',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'FRONTEND_ORIGIN',
] as const;

/**
 * Fail-fast environment validation for ConfigModule.forRoot({ validate }).
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / AUTH_ALLOWED_EMAILS /
 * ADMIN_EMAILS / TEACHER_EMAILS / PORT / MONGO_DNS_SERVERS are optional
 * (Google sign-in is simply disabled without credentials).
 */
export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED_VARS.filter((key) => {
    const value = config[key];
    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    );
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }
  return config;
}
