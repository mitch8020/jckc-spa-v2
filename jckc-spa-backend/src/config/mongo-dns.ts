import {
  getServers,
  promises as dnsPromises,
  setServers,
  type SrvRecord,
} from 'node:dns';

const FALLBACK_MONGO_SRV_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];
const RECOVERABLE_DNS_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEOUT',
  'EAI_AGAIN',
]);

interface DnsApi {
  getServers(): string[];
  setServers(servers: string[]): void;
  resolveSrv(hostname: string): Promise<SrvRecord[]>;
}

/* istanbul ignore next -- behavior is covered through injected DNS adapters. */
function resolveSrvWithNode(hostname: string): Promise<SrvRecord[]> {
  return dnsPromises.resolveSrv(hostname);
}

const nodeDns: DnsApi = {
  getServers,
  setServers,
  resolveSrv: resolveSrvWithNode,
};

/**
 * Node's c-ares resolver can be pointed at a local DNS proxy that refuses SRV
 * lookups even when Windows/system DNS resolves them. Atlas mongodb+srv URIs
 * require SRV, so verify that path before mongoose connects and fall back only
 * for resolver-level transient failures.
 */
export async function configureMongoSrvDns(
  mongoUri: string,
  configuredServers?: string,
  dns: DnsApi = nodeDns,
): Promise<void> {
  const srvRecord = getMongoSrvRecord(mongoUri);
  if (!srvRecord) {
    return;
  }

  const explicitServers = parseDnsServers(configuredServers);
  if (explicitServers.length > 0) {
    dns.setServers(explicitServers);
    return;
  }

  try {
    await dns.resolveSrv(srvRecord);
  } catch (error) {
    if (!isRecoverableDnsError(error)) {
      return;
    }

    const originalServers = dns.getServers();
    dns.setServers(FALLBACK_MONGO_SRV_DNS_SERVERS);

    try {
      await dns.resolveSrv(srvRecord);
    } catch {
      dns.setServers(originalServers);
    }
  }
}

function getMongoSrvRecord(mongoUri: string): string | null {
  try {
    const url = new URL(mongoUri);
    if (url.protocol !== 'mongodb+srv:') {
      return null;
    }
    return `_mongodb._tcp.${url.hostname}`;
  } catch {
    return null;
  }
}

function parseDnsServers(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
}

function isRecoverableDnsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    RECOVERABLE_DNS_CODES.has(error.code)
  );
}
