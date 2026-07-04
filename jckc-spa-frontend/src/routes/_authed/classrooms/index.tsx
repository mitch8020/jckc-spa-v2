import { Link, createFileRoute } from '@tanstack/react-router'
import { CircleAlertIcon, PlusIcon, SchoolIcon } from 'lucide-react'
import { useClassrooms } from '#/api/classrooms'
import { AgeGroupBadge } from '#/components/AgeGroupBadge'
import { EmptyState } from '#/components/EmptyState'
import { GreetingBar } from '#/components/GreetingBar'
import { PageHeader } from '#/components/PageHeader'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'
import { useSessionUser } from '#/lib/session'
import type { ReactNode } from 'react'
import type { ClassroomWithCountDto } from '#/api/types'

export const Route = createFileRoute('/_authed/classrooms/')({
  component: ClassroomsSummaryPage,
})

function ClassroomsSummaryPage() {
  const user = useSessionUser()
  const isAdmin = user.role === 'admin'
  const classroomsQuery = useClassrooms()

  let content: ReactNode
  if (classroomsQuery.isPending) {
    content = (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-44 rounded-3xl" />
        ))}
      </div>
    )
  } else if (classroomsQuery.isError) {
    content = (
      <div className="island-shell rise-in rounded-3xl">
        <EmptyState
          icon={CircleAlertIcon}
          title="Something went wrong"
          message={classroomsQuery.error.message}
        />
      </div>
    )
  } else if (classroomsQuery.data.length === 0) {
    content = (
      <div className="island-shell rise-in rounded-3xl">
        <EmptyState
          icon={SchoolIcon}
          message="No Classrooms Available"
          action={
            isAdmin ? (
              <Button variant="outline" asChild>
                <Link to="/classrooms/new">
                  <PlusIcon /> New Classroom
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  } else {
    content = (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {classroomsQuery.data.map((classroom, index) => (
          <ClassroomCard
            key={classroom.id}
            classroom={classroom}
            isAdmin={isAdmin}
            index={index}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <GreetingBar firstName={user.firstName || user.name} />
      <PageHeader
        kicker="Rooms & teachers"
        title="Classrooms Summary"
        action={
          isAdmin ? (
            <Button asChild>
              <Link to="/classrooms/new">
                <PlusIcon /> New Classroom
              </Link>
            </Button>
          ) : undefined
        }
      />
      {content}
    </div>
  )
}

function ClassroomCard({
  classroom,
  isAdmin,
  index,
}: {
  classroom: ClassroomWithCountDto
  isAdmin: boolean
  index: number
}) {
  return (
    <article
      className="feature-card rise-in flex flex-col rounded-3xl border border-[var(--line)]"
      style={{ animationDelay: `${80 + (index % 9) * 60}ms` }}
    >
      <div className="flex flex-1 items-start gap-4 p-5">
        <AgeGroupBadge
          ageGroup={classroom.ageGroup}
          variant="block"
          className="h-12 w-14 shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <h2 className="display-title min-w-0 truncate text-lg font-semibold">
              <Link
                to="/classrooms/$classroomId"
                params={{ classroomId: classroom.id }}
                className="text-[var(--sea-ink)] no-underline hover:text-[var(--lagoon-deep)]"
              >
                {classroom.classroomName}
              </Link>
            </h2>
            <AgeGroupBadge ageGroup={classroom.ageGroup} />
          </div>
          <dl className="mt-2 space-y-1 text-sm text-[var(--sea-ink-soft)]">
            <div className="flex gap-1.5">
              <dt>Teacher:</dt>
              <dd className="truncate font-semibold text-[var(--sea-ink)]">
                {classroom.teacherName || '—'}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>No. of Students:</dt>
              <dd className="font-semibold text-[var(--sea-ink)]">
                {classroom.studentCount}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex divide-x divide-[var(--line)] border-t border-[var(--line)]">
        <Link
          to="/classrooms/$classroomId"
          params={{ classroomId: classroom.id }}
          className={cn(
            'flex-1 rounded-bl-3xl py-2.5 text-center text-sm font-semibold text-[var(--lagoon-deep)] no-underline hover:bg-[var(--link-bg-hover)]',
            !isAdmin && 'rounded-br-3xl',
          )}
        >
          Details
        </Link>
        {isAdmin ? (
          <Link
            to="/classrooms/$classroomId/edit"
            params={{ classroomId: classroom.id }}
            className="flex-1 rounded-br-3xl py-2.5 text-center text-sm font-semibold text-[var(--lagoon-deep)] no-underline hover:bg-[var(--link-bg-hover)]"
          >
            Edit
          </Link>
        ) : null}
      </div>
    </article>
  )
}
