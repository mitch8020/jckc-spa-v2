import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '#/components/AppShell'
import { authClient } from '#/lib/auth-client'

/**
 * Protected layout: everything under /_authed requires a live better-auth
 * session AND a completed registration. Renders the AppShell chrome around
 * child routes. Client-only (ssr: false) — the session cookie lives on the
 * API origin, so the guard runs in the browser.
 */
export const Route = createFileRoute('/_authed')({
  ssr: false,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (!session) {
      throw redirect({ to: '/' })
    }
    if (!session.user.registrationStatus) {
      throw redirect({ to: '/register' })
    }
    return { session }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { session } = Route.useRouteContext()
  return (
    <AppShell user={session.user}>
      <Outlet />
    </AppShell>
  )
}
