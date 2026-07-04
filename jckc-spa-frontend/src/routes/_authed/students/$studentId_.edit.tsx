import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useStudent, useUpdateStudent } from '#/api/students'
import { EmptyState } from '#/components/EmptyState'
import { PageHeader } from '#/components/PageHeader'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { StudentForm } from './-student-form'
import type { StudentFormValues } from './-student-form'

export const Route = createFileRoute('/_authed/students/$studentId_/edit')({
  // PATCH /api/students/:id is admin-only; teachers may view details but not
  // edit, parents have no access to arbitrary students at all.
  beforeLoad: ({ context, params }) => {
    const role = context.session.user.role
    if (role === 'teacher') {
      throw redirect({
        to: '/students/$studentId',
        params: { studentId: params.studentId },
      })
    }
    if (role !== 'admin') {
      throw redirect({ to: '/students' })
    }
  },
  component: EditStudentPage,
})

function EditStudentPage() {
  const { studentId } = Route.useParams()
  const navigate = Route.useNavigate()
  const studentQuery = useStudent(studentId)
  const updateStudent = useUpdateStudent()

  const handleSubmit = async (values: StudentFormValues) => {
    try {
      await updateStudent.mutateAsync({ id: studentId, ...values })
    } catch {
      // error toast already handled by the mutation hook
      return
    }
    await navigate({ to: '/students/$studentId', params: { studentId } })
  }

  return (
    <div className="space-y-8">
      <PageHeader kicker="Enrollment" title="Edit Student Details" />

      <div
        className="island-shell rise-in max-w-2xl rounded-3xl p-6 sm:p-8"
        style={{ animationDelay: '80ms' }}
      >
        <div className="mb-6">
          <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
            Edit Student Info
          </h2>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Update a student&apos;s information
          </p>
        </div>

        {studentQuery.isPending ? (
          <div className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-5 sm:grid-cols-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ) : studentQuery.isError ? (
          <EmptyState
            message={studentQuery.error.message}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/students">Back to students</Link>
              </Button>
            }
          />
        ) : (
          <StudentForm
            initialValues={{
              studentFirstName: studentQuery.data.studentFirstName,
              studentLastName: studentQuery.data.studentLastName,
              dateOfBirth: studentQuery.data.dateOfBirth,
              studentStreetAddress: studentQuery.data.studentStreetAddress,
              studentCity: studentQuery.data.studentCity,
              studentState: studentQuery.data.studentState,
              studentZIP: studentQuery.data.studentZIP,
            }}
            submitting={updateStudent.isPending}
            onSubmit={handleSubmit}
            cancel={
              <Button asChild type="button" variant="outline">
                <Link to="/students/$studentId" params={{ studentId }}>
                  Cancel
                </Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
