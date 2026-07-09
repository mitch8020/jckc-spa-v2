const LOOPBACK_HOST_ALIASES = new Set(['localhost', '127.0.0.1'])

function isLoopbackAlias(hostname: string): boolean {
  return LOOPBACK_HOST_ALIASES.has(hostname)
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function getBrowserHostname(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.hostname
}

/**
 * Keeps local API calls on the same loopback hostname as the opened frontend.
 * Browsers treat localhost and 127.0.0.1 as different sites for OAuth cookies.
 */
export function resolveApiBaseUrl(
  configuredUrl: string | undefined,
  currentHostname = getBrowserHostname(),
): string {
  const normalizedUrl = configuredUrl?.trim() ?? ''
  if (!normalizedUrl) return ''

  if (!currentHostname || !isLoopbackAlias(currentHostname)) {
    return trimTrailingSlash(normalizedUrl)
  }

  const url = new URL(normalizedUrl)
  if (!isLoopbackAlias(url.hostname) || url.hostname === currentHostname) {
    return trimTrailingSlash(normalizedUrl)
  }

  url.hostname = currentHostname
  return trimTrailingSlash(url.toString())
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(import.meta.env.VITE_API_URL)
}
