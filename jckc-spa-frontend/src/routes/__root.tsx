import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { HomeIcon, SearchXIcon } from 'lucide-react'
import { ThemeProvider } from 'next-themes'
import { EmptyState } from '#/components/EmptyState'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Button } from '#/components/ui/button'
import { Toaster } from '#/components/ui/sonner'
import type { QueryClient } from '@tanstack/react-query'

import appCss from '../styles.css?url'

interface RouterContext {
  queryClient: QueryClient
}

const FAVICON =
  'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐚</text></svg>'

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'JCKC · JC Kidz Clubhouse',
      },
      {
        name: 'description',
        content:
          'JC Kidz Clubhouse — daycare management for families and staff: students, classrooms, guardians and reports.',
      },
      {
        name: 'google-site-verification',
        content: 'DtWrdTBM9iTadhNZMpvZ-W2IQeA34AczsSJ6GjeCPCg',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: FAVICON,
      },
    ],
  }),
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
})

function RootNotFound() {
  return (
    <main className="page-wrap flex min-h-screen items-center justify-center py-12">
      <SurfaceCard className="w-full max-w-xl rounded-3xl">
        <EmptyState
          icon={SearchXIcon}
          title="Page not found"
          message="The page you're looking for isn't available."
          action={
            <Button asChild>
              <Link to="/">
                <HomeIcon data-icon="inline-start" /> Go home
              </Link>
            </Button>
          }
        />
      </SurfaceCard>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
