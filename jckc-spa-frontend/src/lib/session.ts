import { useRouteContext } from '@tanstack/react-router'
import type { SessionUser } from '#/lib/auth-client'

/** Convenience hook for children of the /_authed layout. */
export function useSessionUser(): SessionUser {
  const { session } = useRouteContext({ from: '/_authed' })
  return session.user
}
