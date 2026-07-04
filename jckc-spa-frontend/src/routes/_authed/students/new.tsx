import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateStudent } from '#/api/students'
import { PageHeader } from '#/components/PageHeader'
import { Button } from '#/components/ui/button'
import { useSessionUser } from '#/lib/session'
import { StudentForm } from './-student-form'
import type { StudentFormValues } from './-student-form'

export const Route = createFileRoute('/_authed/students/new')({
  // POST /api/students is admin + parent only — teachers are read-only.
  beforeLoad: ({ context }) => {
    if (context.session.user.role === 'teacher') {
      throw redirect({ to: '/students' })
    }
  },
  component: NewStudentPage,
})

function NewStudentPage() {
  const navigate = Route.useNavigate()
  const user = useSessionUser()
  const createStudent = useCreateStudent()
  const isAdmin = user.role === 'admin'

  const handleSubmit = async (values: StudentFormValues) => {
    let created
    try {
      created = await createStudent.mutateAsync(values)
    } catch {
      // error toast already handled by the mutation hook
      return
    }
    if (isAdmin) {
      // Admin-created students are approved immediately — go to details.
      toast.success(
        `${created.studentFirstName} ${created.studentLastName} registered`,
      )
      await navigate({
        to: '/students/$studentId',
        params: { studentId: created.id },
      })
    } else {
      // Parent-created students become pending applications.
      toast.success('Student Application Submitted!')
      await navigate({ to: '/students' })
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader kicker="New enrollment" title="Student Registration" />

      <div
        className="island-shell rise-in max-w-2xl rounded-3xl p-6 sm:p-8"
        style={{ animationDelay: '80ms' }}
      >
        <div className="mb-6">
          <h2 className="display-title text-xl font-semibold text-[var(--sea-ink)]">
            Student Application
          </h2>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Submit a new student application
          </p>
        </div>

        <StudentForm
          submitting={createStudent.isPending}
          onSubmit={handleSubmit}
          cancel={
            <Button asChild type="button" variant="outline">
              <Link to="/students">Cancel</Link>
            </Button>
          }
        />
      </div>
    </div>
  )
}
