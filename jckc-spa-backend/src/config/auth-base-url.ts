type DynamicAuthBaseURL = {
  allowedHosts: string[];
  fallback: string;
  protocol: 'http' | 'https' | 'auto';
};

type AuthBaseURL = string | DynamicAuthBaseURL;

const LOOPBACK_HOST_ALIASES: Record<string, string[]> = {
  '127.0.0.1': ['localhost'],
  localhost: ['127.0.0.1'],
};

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Allows local OAuth to use whichever loopback hostname started the flow.
 * The state cookie host and Google redirect URI must be the same hostname.
 */
export function resolveAuthBaseURL(configuredUrl: string): AuthBaseURL {
  const url = new URL(configuredUrl);
  const aliases = LOOPBACK_HOST_ALIASES[url.hostname];
  if (!aliases) return trimTrailingSlash(configuredUrl);

  const allowedHosts = new Set<string>([url.host]);
  for (const alias of aliases) {
    const aliasedUrl = new URL(url.origin);
    aliasedUrl.hostname = alias;
    allowedHosts.add(aliasedUrl.host);
  }

  return {
    allowedHosts: [...allowedHosts],
    fallback: trimTrailingSlash(configuredUrl),
    protocol: url.protocol === 'http:' ? 'http' : 'https',
  };
}
