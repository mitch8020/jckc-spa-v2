import { useEffect } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  BabyIcon,
  BlocksIcon,
  CloudRainIcon,
  PencilIcon,
  PlusIcon,
  ShapesIcon,
  SproutIcon,
  UserRoundMinusIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { isRegistrationRequired, useDashboard } from '#/api/dashboard'
import { AgeGroupBadge } from '#/components/AgeGroupBadge'
import { EmptyState } from '#/components/EmptyState'
import { PageHeader } from '#/components/PageHeader'
import { StatCard } from '#/components/StatCard'
import { FeatureCard, SurfaceCard } from '#/components/SurfaceCard'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
// import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { convertAge } from '#/lib/age'
import { useSessionUser } from '#/lib/session'
import type { ReactNode } from 'react'
import type {
  AdminDashboardDto,
  ClassroomWithCountDto,
  ParentDashboardDto,
  StudentDto,
} from '#/api/types'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardPage,
})

const TITLE_BY_ROLE: Record<string, string> = {
  admin: 'Admin Dashboard',
  teacher: 'Teacher Dashboard',
  parent: 'Parent Dashboard',
}

function DashboardPage() {
  const user = useSessionUser()
  const navigate = Route.useNavigate()
  const query = useDashboard()
  const data = query.data
  const error = query.error

  // Stale session edge case: the API says registration is incomplete even
  // though the cached session cookie claimed otherwise.
  useEffect(() => {
    if (isRegistrationRequired(error)) {
      void navigate({ to: '/register' })
    }
  }, [error, navigate])

  const role = data?.role ?? user.role ?? ''
  const isAdmin = role === 'admin'

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        kicker="Overview"
        title={TITLE_BY_ROLE[role] ?? 'Dashboard'}
        action={
          isAdmin ? (
            <Button asChild>
              <Link to="/students/new">
                <PlusIcon data-icon="inline-start" /> New Student
              </Link>
            </Button>
          ) : undefined
        }
      />

      {data ? (
        data.role === 'parent' ? (
          <ParentDashboard data={data} />
        ) : (
          <StaffDashboard data={data} isAdmin={isAdmin} />
        )
      ) : error ? (
        <SurfaceCard
          className="rise-in rounded-3xl"
          style={{ animationDelay: '80ms' }}
        >
          <EmptyState
            icon={CloudRainIcon}
            title="Couldn't load your dashboard"
            message={error.message}
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          />
        </SurfaceCard>
      ) : (
        <DashboardSkeleton />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin / teacher variant — stats + classrooms overview
// ---------------------------------------------------------------------------

function StaffDashboard({
  data,
  isAdmin,
}: {
  data: AdminDashboardDto
  isAdmin: boolean
}) {
  const { stats, classrooms } = data

  const statItems = [
    {
      label: 'Infants in Rooms',
      value: stats.infantsInRooms,
      icon: <BabyIcon />,
      hint: 'In infant classrooms',
    },
    {
      label: 'Toddlers in Rooms',
      value: stats.toddlersInRooms,
      icon: <BlocksIcon />,
      hint: 'In toddler classrooms',
    },
    {
      label: 'Preschoolers in Rooms',
      value: stats.preschoolersInRooms,
      icon: <ShapesIcon />,
      hint: 'In preschool classrooms',
    },
    {
      label: 'Active Students',
      value: stats.activeStudents,
      icon: <UsersRoundIcon />,
      hint: 'Assigned to a classroom',
    },
    {
      label: 'Inactive Students',
      value: stats.inactiveStudents,
      icon: <UserRoundMinusIcon />,
      hint: 'Not yet in a classroom',
    },
  ]

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHeading title="Students Summary" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statItems.map((item, index) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              icon={item.icon}
              hint={item.hint}
              style={{ animationDelay: `${80 + index * 60}ms` }}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Classrooms Summary"
          action={
            isAdmin ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/classrooms">
                  <PencilIcon data-icon="inline-start" /> Edit
                </Link>
              </Button>
            ) : undefined
          }
        />
        {classrooms.length === 0 ? (
          <SurfaceCard className="rise-in rounded-3xl">
            <EmptyState
              title="No classrooms yet"
              message={
                isAdmin
                  ? 'Set up your first classroom to start placing students.'
                  : 'Classrooms will appear here once they are set up.'
              }
              action={
                isAdmin ? (
                  <Button asChild variant="outline">
                    <Link to="/classrooms">Go to Classrooms</Link>
                  </Button>
                ) : undefined
              }
            />
          </SurfaceCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classrooms.map((classroom, index) => (
              <ClassroomTile
                key={classroom.id}
                classroom={classroom}
                index={index}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Classroom tile — same design as the classrooms summary page: legacy
 * INF/TOD/PRE monogram block on the left, name link, age-group pill, teacher
 * and student count.
 */
function ClassroomTile({
  classroom,
  index,
}: {
  classroom: ClassroomWithCountDto
  index: number
}) {
  return (
    <FeatureCard
      className="rise-in flex overflow-hidden rounded-2xl py-0"
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      {/* <AgeGroupBadge
        ageGroup={classroom.ageGroup}
        variant="block"
        className="h-auto w-14 shrink-0 self-stretch rounded-none"
      /> */}
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Link
            to="/classrooms/$classroomId"
            params={{ classroomId: classroom.id }}
            className="display-title truncate text-lg font-semibold text-[var(--sea-ink)] no-underline hover:text-[var(--lagoon-deep)]"
          >
            {classroom.classroomName}
          </Link>
          <AgeGroupBadge ageGroup={classroom.ageGroup} />
        </div>
        <p className="mt-0.5 truncate text-sm text-[var(--sea-ink-soft)]">
          {classroom.teacherName || 'No teacher assigned'}
        </p>
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          No. of Students:{' '}
          <span className="font-semibold text-[var(--sea-ink)]">
            {classroom.studentCount}
          </span>
        </p>
      </div>
    </FeatureCard>
  )
}

// ---------------------------------------------------------------------------
// Parent variant — the parent's own students (no fake check-in table)
// ---------------------------------------------------------------------------

function ParentDashboard({ data }: { data: ParentDashboardDto }) {
  const { registered, pending } = data.students
  const students = [
    ...registered.map((student) => ({ student, pending: false })),
    ...pending.map((student) => ({ student, pending: true })),
  ]

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="My Students" />
      {students.length === 0 ? (
        <SurfaceCard
          className="rise-in rounded-3xl"
          style={{ animationDelay: '80ms' }}
        >
          <EmptyState
            icon={SproutIcon}
            title="No students yet"
            message="You haven't registered any students. Start an application and we'll take it from there."
            action={
              <Button asChild>
                <Link to="/students/new">
                  <PlusIcon data-icon="inline-start" /> Register New Student
                </Link>
              </Button>
            }
          />
        </SurfaceCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map(({ student, pending: isPending }, index) => (
            <StudentCard
              key={student.id}
              student={student}
              pending={isPending}
              index={index}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function StudentCard({
  student,
  pending,
  index,
}: {
  student: StudentDto
  pending: boolean
  index: number
}) {
  return (
    <FeatureCard
      className="rise-in rounded-2xl p-5"
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display-title truncate text-lg font-semibold text-[var(--sea-ink)]">
            {student.studentFirstName} {student.studentLastName}
          </p>
          <p className="mt-0.5 text-sm text-[var(--sea-ink-soft)]">
            {convertAge(student.dateOfBirth)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={pending ? 'pill pill-amber' : 'pill pill-palm'}
        >
          {pending ? 'Pending' : 'Registered'}
        </Badge>
      </div>
      <div className="mt-4 border-t border-[var(--line)] pt-3 text-sm">
        {student.classroom ? (
          <>
            <p className="font-semibold text-[var(--sea-ink)]">
              {student.classroom.classroomName}
            </p>
            <p className="mt-0.5 text-[var(--sea-ink-soft)]">
              {student.classroom.teacherName || 'Teacher to be announced'}
            </p>
          </>
        ) : (
          <p className="text-[var(--sea-ink-soft)] italic">Not yet assigned</p>
        )}
      </div>
    </FeatureCard>
  )
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionHeading({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="rise-in flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)] sm:text-2xl">
          {title}
        </h2>
        {/* <Separator className="mt-2 w-12 bg-[var(--line)]" /> */}
      </div>
      {action ?? null}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
