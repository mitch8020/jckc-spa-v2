import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { getApiBaseUrl } from '#/lib/api-url'

const apiBaseUrl = getApiBaseUrl()

/**
 * better-auth React client. Local split-server development points at
 * `${VITE_API_URL}/api/auth/*`; single-origin deployments leave VITE_API_URL
 * unset and use the backend-served `/api/auth/*` path.
 */
export const authClient = createAuthClient({
  ...(apiBaseUrl ? { baseURL: apiBaseUrl } : {}),
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
