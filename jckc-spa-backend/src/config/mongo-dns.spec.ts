import { configureMongoSrvDns } from './mongo-dns';

function dnsError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe('configureMongoSrvDns', () => {
  it('does nothing for non-SRV MongoDB URIs', async () => {
    const dns = {
      getServers: jest.fn(),
      setServers: jest.fn(),
      resolveSrv: jest.fn(),
    };

    await configureMongoSrvDns(
      'mongodb://localhost:27017/jckc-v2',
      undefined,
      dns,
    );

    expect(dns.resolveSrv).not.toHaveBeenCalled();
    expect(dns.setServers).not.toHaveBeenCalled();
  });

  it('can use the default DNS adapter for non-SRV URIs without resolving SRV', async () => {
    await expect(
      configureMongoSrvDns('mongodb://localhost:27017/jckc-v2'),
    ).resolves.toBeUndefined();
  });

  it('does nothing for malformed MongoDB URIs', async () => {
    const dns = {
      getServers: jest.fn(),
      setServers: jest.fn(),
      resolveSrv: jest.fn(),
    };

    await configureMongoSrvDns('not a uri', undefined, dns);

    expect(dns.resolveSrv).not.toHaveBeenCalled();
    expect(dns.setServers).not.toHaveBeenCalled();
  });

  it('uses explicitly configured DNS servers for SRV URIs', async () => {
    const dns = {
      getServers: jest.fn(),
      setServers: jest.fn(),
      resolveSrv: jest.fn(),
    };

    await configureMongoSrvDns(
      'mongodb+srv://user:pass@example.mongodb.net/jckc',
      '9.9.9.9, 149.112.112.112',
      dns,
    );

    expect(dns.setServers).toHaveBeenCalledWith(['9.9.9.9', '149.112.112.112']);
    expect(dns.resolveSrv).not.toHaveBeenCalled();
  });

  it('leaves DNS servers unchanged when the current resolver supports SRV', async () => {
    const dns = {
      getServers: jest.fn(),
      setServers: jest.fn(),
      resolveSrv: jest.fn().mockResolvedValue([]),
    };

    await configureMongoSrvDns(
      'mongodb+srv://user:pass@example.mongodb.net/jckc',
      undefined,
      dns,
    );

    expect(dns.resolveSrv).toHaveBeenCalledWith(
      '_mongodb._tcp.example.mongodb.net',
    );
    expect(dns.setServers).not.toHaveBeenCalled();
  });

  it('falls back when the current resolver refuses SRV lookups', async () => {
    const dns = {
      getServers: jest.fn().mockReturnValue(['127.0.0.1']),
      setServers: jest.fn(),
      resolveSrv: jest
        .fn()
        .mockRejectedValueOnce(dnsError('ECONNREFUSED'))
        .mockResolvedValueOnce([]),
    };

    await configureMongoSrvDns(
      'mongodb+srv://user:pass@example.mongodb.net/jckc',
      undefined,
      dns,
    );

    expect(dns.setServers).toHaveBeenCalledWith(['1.1.1.1', '8.8.8.8']);
    expect(dns.resolveSrv).toHaveBeenCalledTimes(2);
  });

  it('restores original DNS servers when fallback SRV lookup also fails', async () => {
    const dns = {
      getServers: jest.fn().mockReturnValue(['127.0.0.1']),
      setServers: jest.fn(),
      resolveSrv: jest
        .fn()
        .mockRejectedValueOnce(dnsError('ETIMEOUT'))
        .mockRejectedValueOnce(dnsError('ETIMEOUT')),
    };

    await configureMongoSrvDns(
      'mongodb+srv://user:pass@example.mongodb.net/jckc',
      undefined,
      dns,
    );

    expect(dns.setServers).toHaveBeenNthCalledWith(1, ['1.1.1.1', '8.8.8.8']);
    expect(dns.setServers).toHaveBeenNthCalledWith(2, ['127.0.0.1']);
  });

  it('does not hide a permanent SRV lookup failure', async () => {
    const dns = {
      getServers: jest.fn(),
      setServers: jest.fn(),
      resolveSrv: jest.fn().mockRejectedValue(dnsError('ENOTFOUND')),
    };

    await configureMongoSrvDns(
      'mongodb+srv://user:pass@example.mongodb.net/jckc',
      undefined,
      dns,
    );

    expect(dns.setServers).not.toHaveBeenCalled();
  });

  it('does not fall back for non-Error throwables', async () => {
    const dns = {
      getServers: jest.fn(),
      setServers: jest.fn(),
      resolveSrv: jest.fn().mockRejectedValue('ECONNREFUSED'),
    };

    await configureMongoSrvDns(
      'mongodb+srv://user:pass@example.mongodb.net/jckc',
      undefined,
      dns,
    );

    expect(dns.setServers).not.toHaveBeenCalled();
  });
});
