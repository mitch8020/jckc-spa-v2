import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useRegisterUser } from '#/api/users'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export const Route = createFileRoute('/register')({
  ssr: false,
  component: RegisterPage,
})

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  role: z.enum(['parent', 'teacher'], {
    message: 'Choose an account type',
  }),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date')
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      'Date of birth cannot be in the future',
    ),
  phoneNumber: z.string().trim().min(7, 'Phone number is required'),
})

type RegisterValues = z.infer<typeof registerSchema>

function RegisterPage() {
  const navigate = Route.useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const registerUser = useRegisterUser()

  // Requires a session; already-registered users skip straight to /dashboard.
  useEffect(() => {
    if (isPending) return
    if (!session?.user) {
      void navigate({ to: '/' })
      return
    }
    if (session.user.registrationStatus) {
      void navigate({ to: '/dashboard' })
    }
  }, [isPending, session, navigate])

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      role: 'parent',
      dateOfBirth: '',
      phoneNumber: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync(values)
    } catch {
      // error toast already handled by the mutation hook
      return
    }
    toast.success('Welcome to JC Kidz Clubhouse!')
    // Refresh the cached better-auth session so the _authed guard sees the
    // updated registrationStatus before we land on the dashboard.
    await authClient.getSession({ query: { disableCookieCache: true } })
    await navigate({ to: '/dashboard' })
  })

  const handleCancel = async () => {
    await authClient.signOut()
    await navigate({ to: '/' })
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(640px 420px at 50% 8%, var(--hero-a), transparent 68%), radial-gradient(560px 380px at 18% 88%, var(--hero-b), transparent 70%)',
        }}
      />

      <div className="rise-in w-full max-w-lg">
        <div className="island-shell rounded-3xl p-8 sm:p-10">
          <p className="island-kicker text-center">One last step</p>
          <h1 className="display-title mt-2 text-center text-3xl font-semibold text-[var(--sea-ink)]">
            Register your JCKC account
          </h1>
          {session?.user.email ? (
            <p className="mt-2 text-center text-sm text-[var(--sea-ink-soft)]">
              Signed in as{' '}
              <span className="font-semibold">{session.user.email}</span>
            </p>
          ) : null}

          <Form {...form}>
            <form
              onSubmit={(event) => void onSubmit(event)}
              className="mt-8 grid gap-4"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose an account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of birth</FormLabel>
                      <FormControl>
                        <Input type="date" autoComplete="bday" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          autoComplete="tel"
                          placeholder="423-555-0123"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCancel()}
                >
                  Cancel &amp; sign out
                </Button>
                <Button type="submit" disabled={registerUser.isPending}>
                  {registerUser.isPending
                    ? 'Submitting…'
                    : 'Complete registration'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </main>
  )
}
