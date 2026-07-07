const LOOPBACK_HOST_ALIASES: Record<string, string[]> = {
  '127.0.0.1': ['localhost'],
  localhost: ['127.0.0.1'],
};

/**
 * Browsers treat localhost and 127.0.0.1 as different origins. Accept both
 * loopback spellings for the configured frontend port so local dev works even
 * when the app is opened with the other hostname.
 */
export function resolveFrontendOrigins(frontendOrigin: string): string[] {
  const configuredOrigins = frontendOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length === 0) {
    throw new Error('FRONTEND_ORIGIN must include at least one origin');
  }

  const origins = new Set<string>();

  for (const configuredOrigin of configuredOrigins) {
    const url = new URL(configuredOrigin);
    origins.add(url.origin);

    for (const alias of LOOPBACK_HOST_ALIASES[url.hostname] ?? []) {
      const aliasedUrl = new URL(url.origin);
      aliasedUrl.hostname = alias;
      origins.add(aliasedUrl.origin);
    }
  }

  return [...origins];
}
