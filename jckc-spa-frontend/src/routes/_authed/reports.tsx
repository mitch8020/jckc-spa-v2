import { createFileRoute, redirect } from '@tanstack/react-router'
import { ClipboardListIcon, DownloadIcon, Loader2Icon } from 'lucide-react'
import { useDownloadReport } from '#/api/reports'
import { PageHeader } from '#/components/PageHeader'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { useSessionUser } from '#/lib/session'
import type { ReportKind } from '#/api/reports'
import type { LucideIcon } from 'lucide-react'

export const Route = createFileRoute('/_authed/reports')({
  beforeLoad: ({ context }) => {
    // Reports are staff-only (admin + teacher) — parents go home.
    const role = context.session.user.role
    if (role !== 'admin' && role !== 'teacher') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ReportsPage,
})

const REPORT_CARDS: {
  kind: ReportKind
  label: string
  icon: LucideIcon
  description: string
}[] = [
  {
    kind: 'sign-in-sheet',
    label: 'SIGN IN SHEETS',
    icon: DownloadIcon,
    description:
      'Daily attendance sheet with blank IN / OUT columns for a parent or guardian to print their name, time and signature — one landscape page per classroom.',
  },
  {
    kind: 'roll-call-sheet',
    label: 'ROLL CALL SHEETS',
    icon: DownloadIcon,
    description:
      'Weekly roll call grid with Monday–Friday IN / OUT rows for every student, plus a comments column — one portrait page per classroom.',
  },
]

function ReportsPage() {
  const user = useSessionUser()
  const download = useDownloadReport()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader kicker="Reports" title="Reports Summary" />

      <SurfaceCard
        className="rise-in rounded-3xl p-6 sm:p-8"
        style={{ animationDelay: '80ms' }}
      >
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="size-10 shrink-0 rounded-full p-0"
          >
            <ClipboardListIcon aria-hidden />
          </Badge>
          <div>
            <p className="island-kicker">Print &amp; go</p>
            <p className="text-sm text-[var(--sea-ink-soft)]">
              PDFs are generated fresh from today&apos;s classroom rosters the
              moment you download them.
            </p>
          </div>
        </div>

        <Separator className="my-6 bg-[var(--line)]" />
        <div className="grid gap-6 sm:grid-cols-2">
          {REPORT_CARDS.map((card, index) => {
            const isDownloading =
              download.isPending && download.variables === card.kind
            return (
              <div
                key={card.kind}
                className="rise-in flex flex-col gap-3"
                style={{ animationDelay: `${140 + index * 60}ms` }}
              >
                <Button
                  size="lg"
                  className="h-13 w-full rounded-full text-sm font-bold tracking-[0.14em]"
                  disabled={download.isPending}
                  onClick={() => download.mutate(card.kind)}
                >
                  {isDownloading ? (
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <card.icon data-icon="inline-start" aria-hidden />
                  )}
                  {isDownloading ? 'PREPARING…' : card.label}
                </Button>
                <p className="px-1 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
                  {card.description}
                </p>
              </div>
            )
          })}
        </div>
      </SurfaceCard>
    </div>
  )
}
