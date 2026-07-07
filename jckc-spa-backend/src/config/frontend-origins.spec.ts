import { resolveFrontendOrigins } from './frontend-origins';

describe('resolveFrontendOrigins', () => {
  it('adds localhost for a configured 127.0.0.1 frontend origin', () => {
    expect(resolveFrontendOrigins('http://127.0.0.1:3000')).toEqual([
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ]);
  });

  it('adds 127.0.0.1 for a configured localhost frontend origin', () => {
    expect(resolveFrontendOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('supports multiple comma-separated origins', () => {
    expect(
      resolveFrontendOrigins('https://example.test, http://localhost:5173'),
    ).toEqual([
      'https://example.test',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('rejects blank configured origins', () => {
    expect(() => resolveFrontendOrigins(' ,  ')).toThrow(
      'FRONTEND_ORIGIN must include at least one origin',
    );
  });
});
