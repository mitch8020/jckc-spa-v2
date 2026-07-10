import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  PencilLineIcon,
  PlusIcon,
  Trash2Icon,
  UsersRoundIcon,
} from 'lucide-react'
import {
  useDeleteStudent,
  useStudent,
  useStudentGuardians,
} from '#/api/students'
import { ConfirmDialog } from '#/components/ConfirmDialog'
import {
  TableSkeletonRows,
  tableCellClass,
  tableHeadClass,
} from '#/components/DataTable'
import { EmptyState } from '#/components/EmptyState'
import { PageHeader } from '#/components/PageHeader'
import { StatusPill } from '#/components/StatusPill'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Button } from '#/components/ui/button'
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldTitle,
} from '#/components/ui/field'
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
import type { ReactNode } from 'react'
import type { GuardianForStudentDto, StudentDto } from '#/api/types'

export const Route = createFileRoute('/_authed/students/$studentId')({
  // GET /api/students/:id is admin + teacher — parents only see their own
  // students via /students (mine); send them back there.
  beforeLoad: ({ context }) => {
    if (context.session.user.role === 'parent') {
      throw redirect({ to: '/students' })
    }
  },
  component: StudentDetailsPage,
})

function StudentDetailsPage() {
  const { studentId } = Route.useParams()
  const navigate = Route.useNavigate()
  const user = useSessionUser()
  const isAdmin = user.role === 'admin'

  const studentQuery = useStudent(studentId)
  const guardiansQuery = useStudentGuardians(studentId)
  const deleteStudent = useDeleteStudent()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const student = studentQuery.data

  const handleDelete = async () => {
    if (!student) return
    try {
      await deleteStudent.mutateAsync({
        id: student.id,
        name: `${student.studentFirstName} ${student.studentLastName}`,
      })
    } catch {
      // error toast already handled by the mutation hook
      setConfirmOpen(false)
      return
    }
    setConfirmOpen(false)
    await navigate({ to: '/students' })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker="Enrollment" title="Student Details" />

      {/* Card 1 — Student Info */}
      <SurfaceCard
        className="rise-in rounded-3xl py-0"
        style={{ animationDelay: '80ms' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-4 sm:px-6">
          <div>
            <p className="island-kicker">Profile</p>
            <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
              Student Info
            </h2>
          </div>
          {isAdmin && student ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" /> Delete
              </Button>
              <Button asChild>
                <Link
                  to="/students/$studentId/edit"
                  params={{ studentId: student.id }}
                >
                  <PencilLineIcon data-icon="inline-start" /> Edit Info
                </Link>
              </Button>
            </div>
          ) : null}
        </div>

        {studentQuery.isPending ? (
          <div className="flex flex-col gap-4 px-4 pb-6 sm:px-6">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        ) : studentQuery.isError ? (
          <EmptyState
            message={studentQuery.error.message}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/students">Back to students</Link>
              </Button>
            }
            className="pb-8"
          />
        ) : (
          <StudentInfoList student={studentQuery.data} />
        )}
      </SurfaceCard>

      {/* Card 2 — Parent / Guardian Info */}
      <SurfaceCard
        className="rise-in overflow-hidden rounded-3xl py-0"
        style={{ animationDelay: '160ms' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-4 sm:px-6">
          <div>
            <p className="island-kicker">Family</p>
            <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
              Parent / Guardian Info
            </h2>
          </div>
          {isAdmin ? (
            <Button asChild variant="outline">
              <Link
                to="/students/$studentId/add-guardian"
                params={{ studentId }}
              >
                <PlusIcon data-icon="inline-start" /> Add Parent / Guardian
              </Link>
            </Button>
          ) : null}
        </div>

        <GuardiansTable
          guardians={guardiansQuery.data}
          isPending={guardiansQuery.isPending}
          errorMessage={
            guardiansQuery.isError ? guardiansQuery.error.message : null
          }
          isAdmin={isAdmin}
          studentId={studentId}
        />
      </SurfaceCard>

      {student ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete Student"
          description={`Are you sure you want to delete ${student.studentFirstName} ${student.studentLastName}? This action cannot be undone.`}
          confirmLabel="Delete"
          loading={deleteStudent.isPending}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field
      orientation="responsive"
      className="border-t border-[var(--line)] px-4 py-4 sm:gap-4 sm:px-6 @md/field-group:grid @md/field-group:grid-cols-2"
    >
      <FieldTitle className="text-sm font-semibold text-[var(--sea-ink-soft)]">
        {label}
      </FieldTitle>
      <FieldContent className="text-left text-sm text-[var(--sea-ink)]">
        {children}
      </FieldContent>
    </Field>
  )
}

function StudentInfoList({ student }: { student: StudentDto }) {
  return (
    <FieldGroup className="gap-0 pb-2">
      <InfoRow label="Student Name">
        <span className="font-semibold">
          {student.studentFirstName} {student.studentLastName}
        </span>
      </InfoRow>
      <InfoRow label="Date of Birth">
        {formatDateString(student.dateOfBirth)}
      </InfoRow>
      <InfoRow label="Age">{convertAge(student.dateOfBirth)}</InfoRow>
      <InfoRow label="Student Address">
        {student.studentStreetAddress}, {student.studentCity},{' '}
        {student.studentState} {student.studentZIP}
      </InfoRow>
      <InfoRow label="Status">
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill status={student.classroom ? 'active' : 'inactive'} />
          {!student.applicationApprovalStatus ? (
            <StatusPill status="pending" />
          ) : null}
          {student.classroom ? (
            <span className="text-[var(--sea-ink-soft)]">
              {student.classroom.classroomName}
              {student.classroom.teacherName
                ? ` · ${student.classroom.teacherName}`
                : ''}
            </span>
          ) : null}
        </span>
      </InfoRow>
    </FieldGroup>
  )
}

function GuardiansTable({
  guardians,
  isPending,
  errorMessage,
  isAdmin,
  studentId,
}: {
  guardians: GuardianForStudentDto[] | undefined
  isPending: boolean
  errorMessage: string | null
  isAdmin: boolean
  studentId: string
}) {
  const columnCount = isAdmin ? 5 : 4

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[var(--line)] hover:bg-transparent">
          <TableHead className={tableHeadClass}>Name</TableHead>
          <TableHead className={cn(tableHeadClass, 'hidden lg:table-cell')}>
            Address
          </TableHead>
          <TableHead className={cn(tableHeadClass, 'hidden md:table-cell')}>
            Phone Number
          </TableHead>
          <TableHead className={tableHeadClass}>Relationship</TableHead>
          {isAdmin ? (
            <TableHead className={cn(tableHeadClass, 'text-right')}>
              <span className="sr-only">Edit</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isPending ? (
          <TableSkeletonRows columnCount={columnCount} rows={2} />
        ) : errorMessage ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="whitespace-normal">
              <EmptyState icon={UsersRoundIcon} message={errorMessage} />
            </TableCell>
          </TableRow>
        ) : !guardians || guardians.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="whitespace-normal">
              <EmptyState
                icon={UsersRoundIcon}
                message="No Assigned Parents / Guardians Available"
              />
            </TableCell>
          </TableRow>
        ) : (
          guardians.map((guardian) => {
            const address = `${guardian.guardianStreetAddress}, ${guardian.guardianCity}, ${guardian.guardianState} ${guardian.guardianZIP}`
            return (
              <TableRow
                key={guardian.id}
                className="border-[var(--line)] hover:bg-[var(--link-bg-hover)]"
              >
                <TableCell className={cn(tableCellClass, 'whitespace-normal')}>
                  {isAdmin ? (
                    <Link
                      to="/guardians/$guardianId"
                      params={{ guardianId: guardian.id }}
                      search={{ from: studentId }}
                      className="font-semibold text-[var(--sea-ink)] no-underline hover:text-[var(--lagoon-deep)]"
                    >
                      {guardian.guardianFirstName} {guardian.guardianLastName}
                    </Link>
                  ) : (
                    <span className="font-semibold text-[var(--sea-ink)]">
                      {guardian.guardianFirstName} {guardian.guardianLastName}
                    </span>
                  )}
                  {/* stacked meta for the columns hidden on small screens */}
                  <p className="mt-1 text-xs text-[var(--sea-ink-soft)] lg:hidden">
                    {address}
                  </p>
                  <p className="text-xs text-[var(--sea-ink-soft)] md:hidden">
                    {guardian.phoneNumber}
                  </p>
                </TableCell>
                <TableCell
                  className={cn(
                    tableCellClass,
                    'hidden whitespace-normal text-[var(--sea-ink)] lg:table-cell',
                  )}
                >
                  {address}
                </TableCell>
                <TableCell
                  className={cn(
                    tableCellClass,
                    'hidden text-[var(--sea-ink)] md:table-cell',
                  )}
                >
                  {guardian.phoneNumber}
                </TableCell>
                <TableCell
                  className={cn(tableCellClass, 'text-[var(--sea-ink)]')}
                >
                  {guardian.relationshipToStudent}
                </TableCell>
                {isAdmin ? (
                  <TableCell className={cn(tableCellClass, 'text-right')}>
                    <Link
                      to="/guardians/$guardianId/edit"
                      params={{ guardianId: guardian.id }}
                      search={{ from: studentId }}
                      className="text-sm font-semibold text-[var(--lagoon-deep)]"
                    >
                      Edit
                    </Link>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
