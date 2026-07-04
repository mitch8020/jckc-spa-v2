import {
  Link,
  createFileRoute,
  stripSearchParams,
} from '@tanstack/react-router'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BackpackIcon,
  CheckIcon,
  HourglassIcon,
  PlusIcon,
  SearchXIcon,
} from 'lucide-react'
import { useApproveStudent, useMyStudents, useStudents } from '#/api/students'
import {
  TableSkeletonRows,
  tableCellClass,
  tableHeadClass,
} from '#/components/DataTable'
import { EmptyState } from '#/components/EmptyState'
import { GreetingBar } from '#/components/GreetingBar'
import { PageHeader } from '#/components/PageHeader'
import { PaginationBar } from '#/components/PaginationBar'
import { SearchInput } from '#/components/SearchInput'
import { StatusPill } from '#/components/StatusPill'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
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
import type { SearchSchemaInput } from '@tanstack/react-router'
import type { StudentListParams } from '#/api/keys'
import type { StudentDto, StudentStatusFilter } from '#/api/types'

const DEFAULT_SEARCH: StudentListParams = {
  page: 1,
  status: 'active',
  search: '',
  order: 'asc',
}

export const Route = createFileRoute('/_authed/students/')({
  // Legacy URL semantics (students.md §3-R4c): page >= 1 (junk → 1), status
  // must be exactly active|inactive|all (else active), order 'desc' else asc.
  validateSearch: (
    input: Record<string, unknown> & SearchSchemaInput,
  ): StudentListParams => ({
    page: Math.max(1, Number.parseInt(String(input.page ?? ''), 10) || 1),
    status:
      input.status === 'inactive' || input.status === 'all'
        ? input.status
        : 'active',
    search: typeof input.search === 'string' ? input.search : '',
    order: input.order === 'desc' ? 'desc' : 'asc',
  }),
  search: {
    middlewares: [stripSearchParams(DEFAULT_SEARCH)],
  },
  component: StudentsPage,
})

function StudentsPage() {
  const user = useSessionUser()
  if (user.role === 'parent') return <ParentStudentsPage />
  return <AdminStudentsPage isAdmin={user.role === 'admin'} />
}

// ---------------------------------------------------------------------------
// Admin / teacher — paginated, searchable, filterable summary
// ---------------------------------------------------------------------------

function AdminStudentsPage({ isAdmin }: { isAdmin: boolean }) {
  const user = useSessionUser()
  const params = Route.useSearch()
  const navigate = Route.useNavigate()
  const listQuery = useStudents(params)
  const approveStudent = useApproveStudent()

  // Legacy semantics: any filter/search/sort change resets to page 1.
  const setSearch = (search: string) =>
    void navigate({
      search: (prev) => ({ ...prev, search, page: 1 }),
      replace: true,
    })
  const setStatus = (status: StudentStatusFilter) =>
    void navigate({ search: (prev) => ({ ...prev, status, page: 1 }) })
  const toggleOrder = () =>
    void navigate({
      search: (prev) => ({
        ...prev,
        order: prev.order === 'asc' ? 'desc' : 'asc',
        page: 1,
      }),
    })
  const setPage = (page: number) =>
    void navigate({ search: (prev) => ({ ...prev, page }) })

  const columnCount = isAdmin ? 5 : 4
  const students = listQuery.data?.items ?? []

  const emptyMessage = params.search
    ? `No students found matching "${params.search}"`
    : params.status === 'all'
      ? 'No students found'
      : `No ${params.status} students found`

  return (
    <div className="space-y-6">
      {/* Greeting strip on the staff summary page (ui-layout.md §1.1); the
          legacy parent students page has no header, so ParentStudentsPage
          stays without one. */}
      <GreetingBar firstName={user.firstName || user.name} />
      <PageHeader
        kicker="Enrollment"
        title="Students Summary"
        action={
          isAdmin ? (
            <Button asChild>
              <Link to="/students/new">
                <PlusIcon /> New Student
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div
        className="rise-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: '60ms' }}
      >
        <SearchInput
          value={params.search}
          onChange={setSearch}
          placeholder="Search by name..."
          className="w-full sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--sea-ink-soft)]">
            Status
          </span>
          <Select
            value={params.status}
            onValueChange={(value) => setStatus(value as StudentStatusFilter)}
          >
            <SelectTrigger className="w-40" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All Students</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className="island-shell rise-in overflow-hidden rounded-3xl"
        style={{ animationDelay: '120ms' }}
      >
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead
                className={tableHeadClass}
                aria-sort={params.order === 'asc' ? 'ascending' : 'descending'}
              >
                <button
                  type="button"
                  onClick={toggleOrder}
                  className="inline-flex items-center gap-1 uppercase hover:text-[var(--sea-ink)]"
                >
                  Name
                  {params.order === 'asc' ? (
                    <ArrowUpIcon className="size-3.5" aria-hidden />
                  ) : (
                    <ArrowDownIcon className="size-3.5" aria-hidden />
                  )}
                </button>
              </TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden lg:table-cell')}>
                DOB
              </TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden sm:table-cell')}>
                Age
              </TableHead>
              <TableHead className={tableHeadClass}>Teacher</TableHead>
              {isAdmin ? (
                <TableHead className={cn(tableHeadClass, 'text-right')}>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isPending ? (
              <TableSkeletonRows columnCount={columnCount} />
            ) : listQuery.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="whitespace-normal">
                  <EmptyState
                    icon={SearchXIcon}
                    message={listQuery.error.message}
                  />
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="whitespace-normal">
                  <EmptyState
                    icon={params.search ? SearchXIcon : BackpackIcon}
                    message={emptyMessage}
                  />
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  isAdmin={isAdmin}
                  onApprove={() => approveStudent.mutate(student.id)}
                  approving={
                    approveStudent.isPending &&
                    approveStudent.variables === student.id
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
        {listQuery.data ? (
          <PaginationBar
            pagination={listQuery.data.pagination}
            noun="students"
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  )
}

function StudentRow({
  student,
  isAdmin,
  onApprove,
  approving,
}: {
  student: StudentDto
  isAdmin: boolean
  onApprove: () => void
  approving: boolean
}) {
  const pending = !student.applicationApprovalStatus
  return (
    <TableRow
      className={cn(
        'border-[var(--line)] hover:bg-[var(--link-bg-hover)]',
        pending && 'bg-[color-mix(in_oklab,var(--age-toddler)_6%,transparent)]',
      )}
    >
      <TableCell className={cn(tableCellClass, 'whitespace-normal')}>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/students/$studentId"
            params={{ studentId: student.id }}
            className="font-semibold text-[var(--sea-ink)] no-underline hover:text-[var(--lagoon-deep)]"
          >
            {student.studentFirstName} {student.studentLastName}
          </Link>
          <StatusPill status={student.classroom ? 'active' : 'inactive'} />
          {pending ? <StatusPill status="pending" /> : null}
        </div>
        {/* stacked meta for the columns hidden on small screens */}
        <p className="mt-1 text-xs text-[var(--sea-ink-soft)] lg:hidden">
          DOB: {formatDateString(student.dateOfBirth)}
        </p>
        <p className="text-xs text-[var(--sea-ink-soft)] sm:hidden">
          Age: {convertAge(student.dateOfBirth)}
        </p>
      </TableCell>
      <TableCell
        className={cn(
          tableCellClass,
          'hidden text-[var(--sea-ink)] lg:table-cell',
        )}
      >
        {formatDateString(student.dateOfBirth)}
      </TableCell>
      <TableCell
        className={cn(
          tableCellClass,
          'hidden text-[var(--sea-ink)] sm:table-cell',
        )}
      >
        {convertAge(student.dateOfBirth)}
      </TableCell>
      <TableCell className={tableCellClass}>
        {student.classroom?.teacherName ? (
          <span className="text-[var(--sea-ink)]">
            {student.classroom.teacherName}
          </span>
        ) : (
          <span className="text-[var(--sea-ink-soft)]">Not Assigned</span>
        )}
      </TableCell>
      {isAdmin ? (
        <TableCell className={cn(tableCellClass, 'text-right')}>
          <div className="flex items-center justify-end gap-3">
            {pending ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onApprove}
                disabled={approving}
              >
                <CheckIcon /> {approving ? 'Approving…' : 'Approve'}
              </Button>
            ) : null}
            <Link
              to="/students/$studentId/edit"
              params={{ studentId: student.id }}
              className="text-sm font-semibold text-[var(--lagoon-deep)]"
            >
              Edit
            </Link>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Parent — registered students + pending applications (DESIGN.md decision 2)
// ---------------------------------------------------------------------------

/** Registration date: unpadded M/D/YYYY, matching the legacy parent table. */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso)
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

function ParentStudentsPage() {
  const myQuery = useMyStudents()

  return (
    <div className="space-y-6">
      <PageHeader kicker="Your family" title="Students" />

      <section
        className="island-shell rise-in overflow-hidden rounded-3xl"
        style={{ animationDelay: '80ms' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-4 sm:px-6">
          <div>
            <p className="island-kicker">Enrolled</p>
            <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
              Registered Students
            </h2>
          </div>
          <Button asChild size="sm">
            <Link to="/students/new">
              <PlusIcon /> Register New Student
            </Link>
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className={tableHeadClass}>Name</TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden lg:table-cell')}>
                Birthday
              </TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden sm:table-cell')}>
                Teacher
              </TableHead>
              <TableHead className={tableHeadClass}>
                Registration Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myQuery.isPending ? (
              <TableSkeletonRows columnCount={4} />
            ) : myQuery.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="whitespace-normal">
                  <EmptyState
                    icon={SearchXIcon}
                    message={myQuery.error.message}
                  />
                </TableCell>
              </TableRow>
            ) : myQuery.data.registered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="whitespace-normal">
                  <EmptyState
                    icon={BackpackIcon}
                    message="No Registered Students Available"
                  />
                </TableCell>
              </TableRow>
            ) : (
              myQuery.data.registered.map((student) => (
                <TableRow
                  key={student.id}
                  className="border-[var(--line)] hover:bg-[var(--link-bg-hover)]"
                >
                  <TableCell
                    className={cn(tableCellClass, 'whitespace-normal')}
                  >
                    <p className="font-semibold text-[var(--sea-ink)]">
                      {student.studentFirstName} {student.studentLastName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)] lg:hidden">
                      Birthday: {formatDateString(student.dateOfBirth)}
                    </p>
                    <p className="text-xs text-[var(--sea-ink-soft)] sm:hidden">
                      Teacher:{' '}
                      {student.classroom?.teacherName || 'Not Assigned'}
                    </p>
                  </TableCell>
                  <TableCell
                    className={cn(
                      tableCellClass,
                      'hidden text-[var(--sea-ink)] lg:table-cell',
                    )}
                  >
                    {formatDateString(student.dateOfBirth)}
                  </TableCell>
                  <TableCell
                    className={cn(tableCellClass, 'hidden sm:table-cell')}
                  >
                    {student.classroom?.teacherName ? (
                      <span className="text-[var(--sea-ink)]">
                        {student.classroom.teacherName}
                      </span>
                    ) : (
                      <span className="text-[var(--sea-ink-soft)]">
                        Not Assigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(tableCellClass, 'text-[var(--sea-ink)]')}
                  >
                    {formatCreatedAt(student.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section
        className="island-shell rise-in overflow-hidden rounded-3xl"
        style={{ animationDelay: '160ms' }}
      >
        <div className="px-4 pt-5 pb-4 sm:px-6">
          <p className="island-kicker">Awaiting approval</p>
          <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
            Pending Applications
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className={tableHeadClass}>Name</TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden lg:table-cell')}>
                Birthday
              </TableHead>
              <TableHead className={tableHeadClass}>
                Application Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myQuery.isPending ? (
              <TableSkeletonRows columnCount={3} />
            ) : myQuery.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="whitespace-normal">
                  <EmptyState
                    icon={SearchXIcon}
                    message={myQuery.error.message}
                  />
                </TableCell>
              </TableRow>
            ) : myQuery.data.pending.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="whitespace-normal">
                  <EmptyState
                    icon={HourglassIcon}
                    message="No Pending Applications Available"
                  />
                </TableCell>
              </TableRow>
            ) : (
              myQuery.data.pending.map((student) => (
                <TableRow
                  key={student.id}
                  className="border-[var(--line)] hover:bg-[var(--link-bg-hover)]"
                >
                  <TableCell
                    className={cn(tableCellClass, 'whitespace-normal')}
                  >
                    <p className="font-semibold text-[var(--sea-ink)]">
                      {student.studentFirstName} {student.studentLastName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)] lg:hidden">
                      Birthday: {formatDateString(student.dateOfBirth)}
                    </p>
                  </TableCell>
                  <TableCell
                    className={cn(
                      tableCellClass,
                      'hidden text-[var(--sea-ink)] lg:table-cell',
                    )}
                  >
                    {formatDateString(student.dateOfBirth)}
                  </TableCell>
                  <TableCell className={tableCellClass}>
                    <StatusPill status="pending" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
