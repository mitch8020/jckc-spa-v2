import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(request: Record<string, unknown> = {}) {
  const handler = jest.fn();
  const klass = class TestController {};
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows public routes without checking roles', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);

    expect(guard.canActivate(makeContext())).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, []])(
    'allows authenticated routes with roles %p',
    (roles) => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(roles);

      expect(guard.canActivate(makeContext())).toBe(true);
    },
  );

  it('throws 401 when a protected role route has no user', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['admin']);

    expect(() => guard.canActivate(makeContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('throws 403 when the user has no role', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['admin']);

    expect(() => guard.canActivate(makeContext({ user: {} }))).toThrow(
      ForbiddenException,
    );
  });

  it('throws 403 when the user role is not permitted', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['admin']);

    expect(() =>
      guard.canActivate(makeContext({ user: { role: 'teacher' } })),
    ).toThrow(ForbiddenException);
  });

  it('allows a user whose role is permitted', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['admin', 'teacher']);

    expect(guard.canActivate(makeContext({ user: { role: 'teacher' } }))).toBe(
      true,
    );
  });
});
