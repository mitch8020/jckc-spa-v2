import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'

export const Route = createFileRoute('/')({ component: LoginPage })

const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

function LoginPage() {
  const navigate = Route.useNavigate()
  const { data: session, isPending } = authClient.useSession()

  // Already signed in → straight to the dashboard (the _authed guard sends
  // unregistered users on to /register).
  useEffect(() => {
    if (session?.user) {
      void navigate({ to: '/dashboard' })
    }
  }, [session, navigate])

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  })

  const signInWithGoogle = async () => {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/dashboard`,
    })
    if (error) toast.error(error.message ?? 'Google sign-in failed')
  }

  const onSignIn = signInForm.handleSubmit(async (values) => {
    const { error } = await authClient.signIn.email(values)
    if (error) {
      toast.error(error.message ?? 'Sign-in failed')
      return
    }
    await navigate({ to: '/dashboard' })
  })

  const onSignUp = signUpForm.handleSubmit(async (values) => {
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: `${values.firstName} ${values.lastName}`.trim(),
    })
    if (error) {
      toast.error(error.message ?? 'Sign-up failed')
      return
    }
    toast.success('Account created! One more step to finish registration.')
    await navigate({ to: '/register' })
  })

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* soft hero washes behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(640px 420px at 50% 8%, var(--hero-a), transparent 68%), radial-gradient(560px 380px at 82% 88%, var(--hero-b), transparent 70%)',
        }}
      />

      <div className="rise-in w-full max-w-md">
        <div className="island-shell rounded-3xl p-8 sm:p-10">
          <p className="island-kicker text-center">JC Kidz Clubhouse</p>
          <h1 className="display-title mt-2 text-center text-3xl font-semibold text-[var(--sea-ink)]">
            Log in to your JCKC account
          </h1>

          {session?.user ? (
            <p className="mt-8 text-center text-sm text-[var(--sea-ink-soft)]">
              Taking you to your dashboard…
            </p>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                className="mt-8 w-full hover:cursor-pointer"
                disabled={isPending}
                onClick={() => void signInWithGoogle()}
              >
                <GoogleMark />
                Continue with Google
              </Button>

              {/* 
                <div className="mt-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[var(--line)]" />
                  <span className="text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]">
                    or continue with email
                  </span>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>

                <Tabs defaultValue="sign-in" className="mt-5">
                  <TabsList className="w-full">
                    <TabsTrigger value="sign-in" className="flex-1">
                      Sign in
                    </TabsTrigger>
                    <TabsTrigger value="sign-up" className="flex-1">
                      Create account
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="sign-in" className="mt-4">
                    <Form {...signInForm}>
                      <form
                        onSubmit={(event) => void onSignIn(event)}
                        className="grid gap-4"
                        noValidate
                      >
                        <FormField
                          control={signInForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  autoComplete="email"
                                  placeholder="you@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signInForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  autoComplete="current-password"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="mt-1 w-full"
                          disabled={signInForm.formState.isSubmitting}
                        >
                          {signInForm.formState.isSubmitting
                            ? 'Signing in…'
                            : 'Sign in'}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value="sign-up" className="mt-4">
                    <Form {...signUpForm}>
                      <form
                        onSubmit={(event) => void onSignUp(event)}
                        className="grid gap-4"
                        noValidate
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={signUpForm.control}
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
                            control={signUpForm.control}
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
                          control={signUpForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  autoComplete="email"
                                  placeholder="you@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signUpForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  autoComplete="new-password"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="mt-1 w-full"
                          disabled={signUpForm.formState.isSubmitting}
                        >
                          {signUpForm.formState.isSubmitting
                            ? 'Creating account…'
                            : 'Create account'}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs> 
              */}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--sea-ink-soft)]">
          JC Kidz Clubhouse · 408 W Market St, Johnson City, TN 37604
        </p>
      </div>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.96h5.35c-.5 2.36-2.47 3.72-5.35 3.72a5.78 5.78 0 1 1 0-11.56c1.47 0 2.8.53 3.84 1.4l2.2-2.2A8.9 8.9 0 0 0 12 3a9 9 0 1 0 0 18c5.19 0 8.63-3.65 8.63-8.79 0-.39-.03-.75-.28-1.11Z"
      />
    </svg>
  )
}
