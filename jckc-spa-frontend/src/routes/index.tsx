import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({ component: LoginPage })

function LoginPage() {
  const navigate = Route.useNavigate()
  const { data: session, isPending } = authClient.useSession()

  // Already signed in -> straight to the dashboard. The _authed guard sends
  // unregistered users on to /register.
  useEffect(() => {
    if (session?.user) {
      void navigate({ to: '/dashboard' })
    }
  }, [session, navigate])

  const signInWithGoogle = async () => {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/dashboard`,
    })
    if (error) toast.error(error.message ?? 'Google sign-in failed')
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(640px 420px at 50% 8%, var(--hero-a), transparent 68%), radial-gradient(560px 380px at 82% 88%, var(--hero-b), transparent 70%)',
        }}
      />

      <div className="rise-in w-full max-w-md">
        <SurfaceCard className="rounded-3xl p-8 sm:p-10">
          <p className="island-kicker text-center">JC Kidz Clubhouse</p>
          <h1 className="display-title mt-2 text-center text-3xl font-semibold text-[var(--sea-ink)]">
            Log in to your JCKC account
          </h1>

          {session?.user ? (
            <p className="mt-8 text-center text-sm text-[var(--sea-ink-soft)]">
              Taking you to your dashboard...
            </p>
          ) : (
            <Button
              type="button"
              size="lg"
              className="mt-8 w-full hover:cursor-pointer"
              disabled={isPending}
              onClick={() => void signInWithGoogle()}
            >
              <svg viewBox="0 0 24 24" aria-hidden data-icon="inline-start">
                <path
                  fill="currentColor"
                  d="M21.35 11.1H12v2.96h5.35c-.5 2.36-2.47 3.72-5.35 3.72a5.78 5.78 0 1 1 0-11.56c1.47 0 2.8.53 3.84 1.4l2.2-2.2A8.9 8.9 0 0 0 12 3a9 9 0 1 0 0 18c5.19 0 8.63-3.65 8.63-8.79 0-.39-.03-.75-.28-1.11Z"
                />
              </svg>
              Continue with Google
            </Button>
          )}
        </SurfaceCard>

        <p className="mt-6 text-center text-xs text-[var(--sea-ink-soft)]">
          JC Kidz Clubhouse - 408 W Market St, Johnson City, TN 37604
        </p>
      </div>
    </main>
  )
}
