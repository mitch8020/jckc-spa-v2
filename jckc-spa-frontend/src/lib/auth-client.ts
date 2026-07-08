import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { getApiBaseUrl } from '#/lib/api-url'

/**
 * better-auth React client, pointed at the NestJS backend (which hosts
 * better-auth at `${VITE_API_URL}/api/auth/*`). Session cookies are
 * cross-origin (3000 → 3001), so every call includes credentials.
 */
export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  plugins: [
    inferAdditionalFields({
      user: {
        // All server-managed with defaults — never sent by the client at
        // sign-up, hence `required: false`.
        role: { type: 'string', required: false },
        registrationStatus: { type: 'boolean', required: false },
        firstName: { type: 'string', required: false },
        lastName: { type: 'string', required: false },
        phoneNumber: { type: 'string', required: false },
        dateOfBirth: { type: 'string', required: false },
      },
    }),
  ],
})

export type Session = typeof authClient.$Infer.Session
export type SessionUser = Session['user']
