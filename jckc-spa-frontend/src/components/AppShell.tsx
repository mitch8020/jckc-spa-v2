import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
  UserRoundIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { authClient } from '#/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { cn } from '#/lib/utils'
import type { ReactNode } from 'react'
import type { SessionUser } from '#/lib/auth-client'

// Only param-less top-level pages appear in the nav, so links need no
// `params`/`search` props and stay fully type-checked against the route tree.
type NavPath =
  | '/dashboard'
  | '/students'
  | '/classrooms'
  | '/reports'
  | '/users'
  | '/profile'

interface NavItem {
  label: string
  to: NavPath
}

// Nav link sets per role (ui-layout.md §11 + DESIGN.md decisions 4 & 12).
const NAV_BY_ROLE: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Students', to: '/students' },
    { label: 'Classrooms', to: '/classrooms' },
    { label: 'Reports', to: '/reports' },
    { label: 'Users', to: '/users' },
  ],
  teacher: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Students', to: '/students' },
    { label: 'Classrooms', to: '/classrooms' },
    { label: 'Reports', to: '/reports' },
  ],
  parent: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Students', to: '/students' },
    { label: 'Parent Profile', to: '/profile' },
  ],
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser
  children: ReactNode
}) {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const items = NAV_BY_ROLE[user.role ?? ''] ?? []
  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(`${to}/`)

  const handleSignOut = async () => {
    await authClient.signOut()
    await navigate({ to: '/' })
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.name ||
    user.email
  const initial = (user.firstName || user.name || user.email || '?')
    .charAt(0)
    .toUpperCase()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="site-header">
        <div className="page-wrap flex h-16 items-center gap-6">
          {/* mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open main menu"
              >
                <MenuIcon className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <span className="island-kicker block">Kidz Clubhouse</span>
                  <span className="display-title text-2xl font-semibold text-[var(--sea-ink)]">
                    JCKC
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Main">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-base font-semibold text-[var(--sea-ink-soft)] no-underline hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]',
                      isActive(item.to) &&
                        'bg-[var(--link-bg-hover)] text-[var(--sea-ink)]',
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    void handleSignOut()
                  }}
                  className="mt-2 flex items-center gap-2 rounded-lg border-t border-[var(--line)] px-3 py-2 pt-4 text-left text-base font-semibold text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                >
                  <LogOutIcon className="size-4" /> Sign out
                </button>
              </nav>
            </SheetContent>
          </Sheet>

          {/* brand wordmark */}
          <Link
            to="/dashboard"
            className="flex flex-col no-underline"
            aria-label="JCKC dashboard"
          >
            <span className="display-title text-xl leading-none font-bold text-[var(--sea-ink)]">
              JCKC
            </span>
            <span className="island-kicker text-[0.56rem]">Kidz Clubhouse</span>
          </Link>

          {/* desktop nav */}
          <nav
            className="hidden items-center gap-6 pl-4 md:flex"
            aria-label="Main"
          >
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'nav-link text-sm font-semibold',
                  isActive(item.to) && 'is-active',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* right side: theme toggle + avatar menu */}
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Avatar className="size-9 border border-[var(--line)]">
                    {user.image ? (
                      <AvatarImage src={user.image} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-[var(--chip-bg)] font-bold text-[var(--lagoon-deep)]">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuLabel>
                  <span className="block truncate font-semibold">
                    {displayName}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void navigate({ to: '/profile' })}
                >
                  <UserRoundIcon /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOutIcon /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="page-wrap flex-1 py-8">{children}</main>

      <footer className="site-footer mt-12">
        <div className="page-wrap flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-[var(--sea-ink-soft)]">
          <span className="font-semibold">JC Kidz Clubhouse</span>
          <span>408 W Market St, Johnson City, TN 37604</span>
        </div>
      </footer>
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <SunIcon className="size-4 dark:hidden" />
      <MoonIcon className="hidden size-4 dark:block" />
    </Button>
  )
}
