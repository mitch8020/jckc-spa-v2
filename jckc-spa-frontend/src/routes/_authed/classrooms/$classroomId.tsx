import { Link, createFileRoute } from '@tanstack/react-router'
import { CircleAlertIcon, PencilIcon, UsersRoundIcon } from 'lucide-react'
import { useClassroom } from '#/api/classrooms'
import { ApiError } from '#/api/client'
import { AgeGroupBadge } from '#/components/AgeGroupBadge'
import { tableCellClass, tableHeadClass } from '#/components/DataTable'
import { EmptyState } from '#/components/EmptyState'
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
import { convertAge, formatDateString } from '#/lib/age'
import { cn } from '#/lib/utils'
import { useSessionUser } from '#/lib/session'
import type { StudentDto } from '#/api/types'

export const Route = createFileRoute('/_authed/classrooms/$classroomId')({
  component: ClassroomDetailsPage,
})

function ClassroomDetailsPage() {
  const { classroomId } = Route.useParams()
  const user = useSessionUser()
  const isAdmin = user.role === 'admin'
  const detailQuery = useClassroom(classroomId)

  if (detailQuery.isPending) {
    return (
      <div className="space-y-8">
        <PageHeader kicker="Classrooms" title="Classroom Details" />
        <div className="grid items-start gap-6 md:grid-cols-12">
          <Skeleton className="h-64 rounded-3xl md:col-span-5" />
          <Skeleton className="h-64 rounded-3xl md:col-span-7" />
        </div>
      </div>
    )
  }

  const detail = detailQuery.data
  if (!detail) {
    const error = detailQuery.error
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="space-y-8">
        <PageHeader kicker="Classrooms" title="Classroom Details" />
        <div className="island-shell rise-in rounded-3xl">
          <EmptyState
            icon={CircleAlertIcon}
            title={notFound ? 'Classroom not found' : 'Something went wrong'}
            message={
              notFound
                ? 'This classroom may have been deleted.'
                : error.message || 'Unable to load this classroom.'
            }
            action={
              <Button variant="outline" asChild>
                <Link to="/classrooms">Back to Classrooms</Link>
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const { classroom, students } = detail

  return (
    <div className="space-y-8">
      <PageHeader kicker="Classrooms" title="Classroom Details" />

      <div className="grid items-start gap-6 md:grid-cols-12">
        {/* Classroom Info */}
        <section
          className="island-shell rise-in rounded-3xl p-6 md:col-span-5"
          style={{ animationDelay: '80ms' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
              Classroom Info
            </h2>
            {isAdmin ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/classrooms/$classroomId/edit"
                  params={{ classroomId }}
                >
                  <PencilIcon /> Edit Info
                </Link>
              </Button>
            ) : null}
          </div>

          <dl className="mt-4 divide-y divide-[var(--line)] text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-[var(--sea-ink-soft)]">Classroom Name</dt>
              <dd className="text-right font-semibold text-[var(--sea-ink)]">
                {classroom.classroomName}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-[var(--sea-ink-soft)]">Age Group</dt>
              <dd>
                <AgeGroupBadge ageGroup={classroom.ageGroup} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-[var(--sea-ink-soft)]">Teacher</dt>
              <dd className="text-right font-semibold text-[var(--sea-ink)]">
                {classroom.teacherName || '—'}
              </dd>
            </div>
          </dl>
        </section>

        {/* Assigned Students */}
        <section
          className="island-shell rise-in overflow-hidden rounded-3xl md:col-span-7"
          style={{ animationDelay: '160ms' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
            <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
              Assigned Students
            </h2>
            {isAdmin ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/classrooms/$classroomId/roster"
                  params={{ classroomId }}
                >
                  <UsersRoundIcon /> Edit Student List
                </Link>
              </Button>
            ) : null}
          </div>

          {students.length === 0 ? (
            <EmptyState
              icon={UsersRoundIcon}
              message="No Assigned Students Available"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--line)] hover:bg-transparent">
                  <TableHead className={tableHeadClass}>Name</TableHead>
                  <TableHead
                    className={cn(tableHeadClass, 'hidden lg:table-cell')}
                  >
                    DOB
                  </TableHead>
                  <TableHead className={tableHeadClass}>Age</TableHead>
                  {isAdmin ? (
                    <TableHead className={cn(tableHeadClass, 'text-right')}>
                      <span className="sr-only">Edit</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    isAdmin={isAdmin}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  )
}

function StudentRow({
  student,
  isAdmin,
}: {
  student: StudentDto
  isAdmin: boolean
}) {
  return (
    <TableRow className="border-[var(--line)] hover:bg-[var(--link-bg-hover)]">
      <TableCell className={tableCellClass}>
        <Link
          to="/students/$studentId"
          params={{ studentId: student.id }}
          className="font-semibold text-[var(--lagoon-deep)]"
        >
          {student.studentFirstName} {student.studentLastName}
        </Link>
        <p className="mt-0.5 text-xs text-[var(--sea-ink-soft)] lg:hidden">
          DOB: {formatDateString(student.dateOfBirth)}
        </p>
      </TableCell>
      <TableCell
        className={cn(
          tableCellClass,
          'hidden text-[var(--sea-ink-soft)] lg:table-cell',
        )}
      >
        {formatDateString(student.dateOfBirth)}
      </TableCell>
      <TableCell className={cn(tableCellClass, 'text-[var(--sea-ink-soft)]')}>
        {convertAge(student.dateOfBirth)}
      </TableCell>
      {isAdmin ? (
        <TableCell className={cn(tableCellClass, 'text-right')}>
          <Link
            to="/students/$studentId/edit"
            params={{ studentId: student.id }}
            className="text-sm font-semibold text-[var(--lagoon-deep)]"
          >
            Edit
          </Link>
        </TableCell>
      ) : null}
    </TableRow>
  )
}
