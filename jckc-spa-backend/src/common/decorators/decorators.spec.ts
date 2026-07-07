import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { IS_PUBLIC_KEY, Public } from './public.decorator';
import { ROLES_KEY, Roles } from './roles.decorator';

type RouteArgFactory = (data: unknown, context: ExecutionContext) => unknown;

describe('custom decorators', () => {
  it('marks handlers as public', () => {
    class TestController {
      @Public()
      check() {
        return 'ok';
      }
    }

    const handler = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'check',
    )?.value as () => string;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it('stores role metadata on handlers', () => {
    class TestController {
      @Roles('admin', 'teacher')
      list() {
        return [];
      }
    }

    const handler = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'list',
    )?.value as () => unknown[];

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      'admin',
      'teacher',
    ]);
  });

  it('extracts the authenticated user from the request', () => {
    class TestController {
      show(@CurrentUser() user: unknown) {
        return user;
      }
    }

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'show',
    ) as Record<string, { factory: RouteArgFactory }>;
    const entry = Object.values(metadata)[0];
    const user = { id: 'user-1' };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;

    expect(entry.factory(undefined, context)).toBe(user);
  });
});
