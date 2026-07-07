import { describe, expect, it, vi } from 'vitest'
import { ApiError, get } from './client'
import { isRegistrationRequired, useDashboard } from './dashboard'
import type * as ClientModule from './client'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options) => options),
}))

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof ClientModule>('./client')
  return { ...actual, get: vi.fn() }
})

describe('dashboard api', () => {
  it('detects the registration-required API error', () => {
    expect(isRegistrationRequired(new ApiError(403, 'REGISTRATION_REQUIRED'))).toBe(
      true,
    )
    expect(isRegistrationRequired(new ApiError(403, 'Forbidden'))).toBe(false)
    expect(isRegistrationRequired(new ApiError(401, 'REGISTRATION_REQUIRED'))).toBe(
      false,
    )
    expect(isRegistrationRequired(new Error('REGISTRATION_REQUIRED'))).toBe(false)
  })

  it('configures dashboard query retries and query function', async () => {
    vi.mocked(get).mockResolvedValue({
      role: 'parent',
      students: { registered: [], pending: [] },
    })

    const options = useDashboard() as {
      queryKey: readonly string[]
      queryFn: () => Promise<unknown>
      retry: (failureCount: number, error: Error) => boolean
    }

    expect(options.queryKey).toEqual(['dashboard'])
    await expect(options.queryFn()).resolves.toEqual({
      role: 'parent',
      students: { registered: [], pending: [] },
    })
    expect(get).toHaveBeenCalledWith('/api/dashboard')
    expect(options.retry(0, new ApiError(401, 'Unauthorized'))).toBe(false)
    expect(options.retry(0, new ApiError(403, 'Forbidden'))).toBe(false)
    expect(options.retry(0, new ApiError(500, 'Oops'))).toBe(true)
    expect(options.retry(1, new Error('network'))).toBe(false)
  })
})
