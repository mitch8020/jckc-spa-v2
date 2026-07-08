import { resolveAuthBaseURL } from './auth-base-url';

describe('resolveAuthBaseURL', () => {
  it('returns static base URLs for non-loopback hosts', () => {
    expect(resolveAuthBaseURL('https://api.example.test')).toBe(
      'https://api.example.test',
    );
  });

  it('allows both loopback host spellings when configured with 127.0.0.1', () => {
    expect(resolveAuthBaseURL('http://127.0.0.1:3001')).toEqual({
      allowedHosts: ['127.0.0.1:3001', 'localhost:3001'],
      fallback: 'http://127.0.0.1:3001',
      protocol: 'http',
    });
  });

  it('allows both loopback host spellings when configured with localhost', () => {
    expect(resolveAuthBaseURL('http://localhost:3001')).toEqual({
      allowedHosts: ['localhost:3001', '127.0.0.1:3001'],
      fallback: 'http://localhost:3001',
      protocol: 'http',
    });
  });
});
