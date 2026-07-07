import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const API_URL = 'http://127.0.0.1:3001'

type SessionUser = {
  id: string
  email: string
  name: string
  role: 'admin' | 'teacher' | 'parent' | ''
  registrationStatus: boolean
  firstName: string
  lastName: string
  phoneNumber: string
  dateOfBirth: string
  emailVerified: boolean
  image: string | null
  createdAt: string
  updatedAt: string
}

type SessionPayload = {
  user: SessionUser
  session: {
    id: string
    token: string
    userId: string
    expiresAt: string
    createdAt: string
    updatedAt: string
    ipAddress: string
    userAgent: string
  }
}

function buildUser(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: 'user-1',
    email: 'ada.admin@example.com',
    name: 'Ada Admin',
    role: 'admin',
    registrationStatus: true,
    firstName: 'Ada',
    lastName: 'Admin',
    phoneNumber: '4235550100',
    dateOfBirth: '1990-05-04',
    emailVerified: true,
    image: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildSession(user: SessionUser): SessionPayload {
  return {
    user,
    session: {
      id: `session-${user.id}`,
      token: `token-${user.id}`,
      userId: user.id,
      expiresAt: '2099-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ipAddress: '127.0.0.1',
      userAgent: 'playwright',
    },
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockApi(
  page: Page,
  initialSession: SessionPayload | null = null,
) {
  let currentSession = initialSession
  const requests: string[] = []

  await page.route(`${API_URL}/api/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    requests.push(`${method} ${path}`)

    if (path === '/api/auth/get-session') {
      return json(route, currentSession)
    }

    if (method === 'POST' && path === '/api/auth/sign-in/email') {
      currentSession = buildSession(buildUser({ role: 'admin' }))
      return json(route, currentSession)
    }

    if (method === 'POST' && path === '/api/auth/sign-up/email') {
      const body = request.postDataJSON() as { email: string; name: string }
      const [firstName = '', lastName = ''] = body.name.split(' ')
      currentSession = buildSession(
        buildUser({
          id: 'user-parent',
          email: body.email,
          name: body.name,
          role: '',
          registrationStatus: false,
          firstName,
          lastName,
          phoneNumber: '',
          dateOfBirth: '',
        }),
      )
      return json(route, currentSession)
    }

    if (method === 'POST' && path === '/api/auth/sign-out') {
      currentSession = null
      return json(route, { success: true })
    }

    if (method === 'POST' && path === '/api/users/register') {
      const body = request.postDataJSON() as {
        firstName: string
        lastName: string
        role: 'parent' | 'teacher'
        dateOfBirth: string
        phoneNumber: string
      }
      const user = buildUser({
        id: currentSession?.user.id ?? 'user-parent',
        email: currentSession?.user.email ?? 'pat.parent@example.com',
        name: `${body.firstName} ${body.lastName}`,
        role: body.role,
        registrationStatus: true,
        firstName: body.firstName,
        lastName: body.lastName,
        phoneNumber: body.phoneNumber,
        dateOfBirth: body.dateOfBirth,
      })
      currentSession = buildSession(user)
      return json(route, user, 201)
    }

    if (method === 'GET' && path === '/api/dashboard') {
      if (!currentSession) {
        return json(route, { message: 'Unauthorized' }, 401)
      }

      if (!currentSession.user.registrationStatus) {
        return json(route, { message: 'REGISTRATION_REQUIRED' }, 403)
      }

      if (currentSession.user.role === 'parent') {
        return json(route, {
          role: 'parent',
          students: {
            registered: [],
            pending: [],
          },
        })
      }

      return json(route, {
        role: currentSession.user.role,
        stats: {
          infantsInRooms: 3,
          toddlersInRooms: 2,
          preschoolersInRooms: 4,
          activeStudents: 9,
          inactiveStudents: 1,
        },
        classrooms: [
          {
            id: 'classroom-1',
            classroomName: 'Guppy Room',
            ageGroup: 'infant',
            teacherName: 'Ms. Reef',
            studentCount: 3,
          },
        ],
      })
    }

    return json(
      route,
      { message: `Unhandled e2e mock route: ${method} ${path}` },
      500,
    )
  })

  return { requests }
}

test('redirects unauthenticated protected routes to the login page', async ({
  page,
}) => {
  await mockApi(page)

  await page.goto('/dashboard')

  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Log in to your JCKC account' }),
  ).toBeVisible()
})

test('validates sign-in fields before submitting credentials', async ({
  page,
}) => {
  const api = await mockApi(page)

  await page.goto('/')
  await page
    .locator('form')
    .first()
    .getByRole('button', { name: 'Sign in', exact: true })
    .click()

  await expect(page.getByText('Enter a valid email address')).toBeVisible()
  await expect(page.getByText('Enter your password')).toBeVisible()
  expect(api.requests).not.toContain('POST /api/auth/sign-in/email')
})

test('takes a new email user through registration and onto the parent dashboard', async ({
  page,
}) => {
  const api = await mockApi(page)

  await page.goto('/')
  await page.getByRole('tab', { name: 'Create account' }).click()

  await page.getByLabel('First name').fill('Pat')
  await page.getByLabel('Last name').fill('Parent')
  await page.getByLabel('Email').fill('pat.parent@example.com')
  await page.getByLabel('Password').fill('Sup3r-secret-pw!')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL('/register')
  await expect(page.getByText('Signed in as pat.parent@example.com')).toBeVisible()

  await page.getByLabel('First name').fill('Pat')
  await page.getByLabel('Last name').fill('Parent')
  await page.getByLabel('Date of birth').fill('1990-05-04')
  await page.getByLabel('Phone number').fill('423-555-0123')
  await page
    .getByRole('button', { name: 'Complete registration' })
    .click()

  await expect(page).toHaveURL('/dashboard')
  await expect(
    page.getByRole('heading', { name: 'Parent Dashboard' }),
  ).toBeVisible()
  await expect(page.getByText('No students yet')).toBeVisible()
  expect(api.requests).toContain('POST /api/auth/sign-up/email')
  expect(api.requests).toContain('POST /api/users/register')
})

test('renders the admin dashboard and signs out through the account menu', async ({
  page,
}) => {
  const api = await mockApi(page, buildSession(buildUser({ role: 'admin' })))

  await page.goto('/dashboard')

  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toBeVisible()
  await expect(page.getByText('No. of Active Students')).toBeVisible()
  await expect(page.getByText('Guppy Room')).toBeVisible()

  await page.getByLabel('Account menu').click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()

  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Log in to your JCKC account' }),
  ).toBeVisible()
  expect(api.requests).toContain('POST /api/auth/sign-out')
})
