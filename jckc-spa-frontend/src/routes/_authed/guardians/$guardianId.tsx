import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  BabyIcon,
  PencilLineIcon,
  Trash2Icon,
  UnlinkIcon,
  UsersRoundIcon,
} from 'lucide-react'
import {
  useDeleteGuardian,
  useGuardian,
  useRemoveGuardianLink,
} from '#/api/guardians'
import { ConfirmDialog } from '#/components/ConfirmDialog'
import { tableCellClass, tableHeadClass } from '#/components/DataTable'
import { EmptyState } from '#/components/EmptyState'
import { GreetingBar } from '#/components/GreetingBar'
import { PageHeader } from '#/components/PageHeader'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { GuardianInfoList } from '#/routes/_authed/guardians/-guardian-form'
import { convertAge, formatDateString } from '#/lib/age'
import { cn } from '#/lib/utils'
import { useSessionUser } from '#/lib/session'
import type { GuardianLinkDto } from '#/api/types'

interface GuardianDetailSearch {
  /** Student id of the page we arrived from (for post-delete navigation). */
  from?: string
}

export const Route = createFileRoute('/_authed/guardians/$guardianId')({
  validateSearch: (search: Record<string, unknown>): GuardianDetailSearch => ({
    from:
      typeof search.from === 'string' && search.from !== ''
        ? search.from
        : undefined,
  }),
  beforeLoad: ({ context }) => {
    // Guardian management is admin-only (fixes legacy quirk Q1).
    if (context.session.user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: GuardianDetailsPage,
})

function GuardianDetailsPage() {
  const { guardianId } = Route.useParams()
  const { from } = Route.useSearch()
  const navigate = Route.useNavigate()
  const user = useSessionUser()
  const guardianQuery = useGuardian(guardianId)
  const deleteGuardian = useDeleteGuardian()
  const removeLink = useRemoveGuardianLink()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [removingLink, setRemovingLink] = useState<GuardianLinkDto | null>(null)

  const guardian = guardianQuery.data

  if (!guardian) {
    return (
      <div className="space-y-8">
        <GreetingBar firstName={user.firstName || user.name} />
        <PageHeader
          kicker="Parents & Guardians"
          title="Parent / Guardian Details"
        />
        {guardianQuery.isError ? (
          <div className="island-shell rise-in rounded-3xl">
            <EmptyState
              icon={UsersRoundIcon}
              title="Parent / guardian not found"
              message="This parent / guardian may have been deleted, or the link you followed is out of date."
              action={
                <Button asChild>
                  <Link to="/students">Back to Students</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="island-shell rounded-3xl p-6 sm:p-8">
              <Skeleton className="h-6 w-52" />
              <div className="mt-6 space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
            <div className="island-shell rounded-3xl p-6 sm:p-8">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="mt-6 h-32 w-full" />
            </div>
          </>
        )}
      </div>
    )
  }

  const guardianName = `${guardian.guardianFirstName} ${guardian.guardianLastName}`
  const linkCount = guardian.students.length

  const handleDeleteGuardian = () => {
    deleteGuardian.mutate(guardianId, {
      onSuccess: () => {
        setConfirmingDelete(false)
        // Back to the student we came from, or the students list.
        if (from) {
          void navigate({
            to: '/students/$studentId',
            params: { studentId: from },
          })
        } else {
          void navigate({ to: '/students' })
        }
      },
    })
  }

  const handleRemoveLink = () => {
    if (!removingLink) return
    removeLink.mutate(
      { guardianId, studentId: removingLink.studentId },
      { onSuccess: () => setRemovingLink(null) },
    )
  }

  return (
    <div className="space-y-8">
      {/* Greeting strip on detail pages (ui-layout.md §1.1). */}
      <GreetingBar firstName={user.firstName || user.name} />
      <PageHeader
        kicker="Parents & Guardians"
        title="Parent / Guardian Details"
      />

      {/* Card 1 — Parent / Guardian Info */}
      <section
        className="island-shell rise-in rounded-3xl"
        style={{ animationDelay: '60ms' }}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-6 py-5 sm:px-8">
          <div>
            <p className="island-kicker">Contact</p>
            <h2 className="display-title mt-0.5 text-xl font-semibold text-[var(--sea-ink)]">
              Parent / Guardian Info
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link
                to="/guardians/$guardianId/edit"
                params={{ guardianId }}
                search={{ from }}
              >
                <PencilLineIcon /> Edit Info
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2Icon /> Delete
            </Button>
          </div>
        </header>
        <div className="px-6 py-2 sm:px-8">
          <GuardianInfoList guardian={guardian} />
        </div>
      </section>

      {/* Card 2 — Assigned Students */}
      <section
        className="island-shell rise-in overflow-hidden rounded-3xl"
        style={{ animationDelay: '140ms' }}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-6 py-5 sm:px-8">
          <div>
            <p className="island-kicker">Little ones</p>
            <h2 className="display-title mt-0.5 text-xl font-semibold text-[var(--sea-ink)]">
              Assigned Students
            </h2>
          </div>
          <span className="pill pill-lagoon">
            {linkCount} {linkCount === 1 ? 'student' : 'students'}
          </span>
        </header>

        {linkCount === 0 ? (
          <EmptyState
            icon={BabyIcon}
            message="No Assigned Students Available"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--line)] hover:bg-transparent">
                <TableHead className={cn(tableHeadClass, 'px-6 sm:px-8')}>
                  Name
                </TableHead>
                <TableHead
                  className={cn(tableHeadClass, 'hidden lg:table-cell')}
                >
                  Date of Birth
                </TableHead>
                <TableHead
                  className={cn(tableHeadClass, 'hidden md:table-cell')}
                >
                  Age
                </TableHead>
                <TableHead
                  className={cn(
                    tableHeadClass,
                    'hidden text-center sm:table-cell',
                  )}
                >
                  Relationship
                </TableHead>
                <TableHead className={cn(tableHeadClass, 'text-center')}>
                  Authorized for Pickup
                </TableHead>
                <TableHead
                  className={cn(tableHeadClass, 'px-6 text-right sm:px-8')}
                >
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guardian.students.map((link) => {
                const student = link.student
                return (
                  <TableRow
                    key={link.studentId}
                    className="border-[var(--line)]"
                  >
                    <TableCell className={cn(tableCellClass, 'px-6 sm:px-8')}>
                      {student ? (
                        <Link
                          to="/students/$studentId"
                          params={{ studentId: student.id }}
                          className="font-semibold text-[var(--lagoon-deep)]"
                        >
                          {student.studentFirstName} {student.studentLastName}
                        </Link>
                      ) : (
                        // Dangling legacy link — render gracefully, never crash.
                        <span className="grid gap-0.5">
                          <span className="text-sm font-medium text-[var(--sea-ink-soft)] italic">
                            Unresolved link
                          </span>
                          <code className="font-mono text-xs text-[var(--sea-ink-soft)]">
                            {link.studentId}
                          </code>
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        tableCellClass,
                        'hidden text-[var(--sea-ink)] lg:table-cell',
                      )}
                    >
                      {student ? formatDateString(student.dateOfBirth) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        tableCellClass,
                        'hidden text-[var(--sea-ink)] md:table-cell',
                      )}
                    >
                      {student ? convertAge(student.dateOfBirth) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        tableCellClass,
                        'hidden text-center sm:table-cell',
                        student
                          ? 'text-[var(--sea-ink)]'
                          : 'text-[var(--sea-ink-soft)]',
                      )}
                    >
                      {link.relationshipToStudent || '—'}
                    </TableCell>
                    <TableCell className={cn(tableCellClass, 'text-center')}>
                      <span
                        className={cn(
                          'pill',
                          link.authorizedToPickUp
                            ? 'pill-palm'
                            : 'pill-neutral',
                        )}
                      >
                        {link.authorizedToPickUp ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(tableCellClass, 'px-6 text-right sm:px-8')}
                    >
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setRemovingLink(link)}
                      >
                        <UnlinkIcon /> Remove link
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this parent / guardian?"
        description={`${guardianName} and all of their student links will be permanently removed. Student records are not affected. This cannot be undone.`}
        confirmLabel="Delete guardian"
        loading={deleteGuardian.isPending}
        onConfirm={handleDeleteGuardian}
      />

      <ConfirmDialog
        open={removingLink !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingLink(null)
        }}
        title="Remove student link?"
        description={
          removingLink?.student
            ? `${removingLink.student.studentFirstName} ${removingLink.student.studentLastName} will no longer be linked to ${guardianName}. The student's record is not deleted.`
            : 'This unresolved legacy link will be removed from this parent / guardian.'
        }
        confirmLabel="Remove link"
        loading={removeLink.isPending}
        onConfirm={handleRemoveLink}
      />
    </div>
  )
}
