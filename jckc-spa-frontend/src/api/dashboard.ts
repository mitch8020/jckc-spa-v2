import { useQuery } from '@tanstack/react-query'
import { ApiError, get } from '#/api/client'
import { keys } from '#/api/keys'
import type { DashboardDto } from '#/api/types'

/**
 * True when the API rejected the dashboard because the authenticated user has
 * not completed in-app registration (403 REGISTRATION_REQUIRED) — the caller
 * redirects to /register.
 */
export function isRegistrationRequired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.message === 'REGISTRATION_REQUIRED'
  )
}

/**
 * GET /api/dashboard — role-shaped payload (admin/teacher stats + classrooms,
 * parent students). Auth failures are terminal, so never retried.
 */
export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard.all,
    queryFn: () => get<DashboardDto>('/api/dashboard'),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        return false
      }
      return failureCount < 1
    },
  })
}
