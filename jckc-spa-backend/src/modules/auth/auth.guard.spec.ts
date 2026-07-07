import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import type { AuthInstance } from './auth.provider';

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, unknown>) => ({
    sourceHeaders: headers,
  })),
}));

jest.mock('./auth.provider', () => ({
  AUTH_INSTANCE: 'AUTH_INSTANCE',
}));

function makeContext(request: Record<string, unknown>) {
  return {
    getHandler: () => jest.fn(),
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let auth: { api: { getSession: jest.Mock } };
  let guard: AuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    auth = { api: { getSession: jest.fn() } };
    guard = new AuthGuard(
      reflector as unknown as Reflector,
      auth as unknown as AuthInstance,
    );
  });

  it('allows public routes without resolving a session', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(makeContext({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it.each([undefined, { user: undefined }])(
    'throws 401 when getSession returns %p',
    async (session) => {
      reflector.getAllAndOverride.mockReturnValue(false);
      auth.api.getSession.mockResolvedValue(session);

      await expect(
        guard.canActivate(makeContext({ headers: { cookie: 'sid=1' } })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('attaches the session user to the request', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const request = { headers: { cookie: 'sid=1' } };
    const user = { id: 'user-1', role: 'admin' };
    auth.api.getSession.mockResolvedValue({ user });

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);

    expect(auth.api.getSession).toHaveBeenCalledWith({
      headers: { sourceHeaders: request.headers },
    });
    expect(request).toHaveProperty('user', user);
  });
});
