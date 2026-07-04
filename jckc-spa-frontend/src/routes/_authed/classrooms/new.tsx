import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useCreateClassroom } from '#/api/classrooms'
import { PageHeader } from '#/components/PageHeader'
import { Button } from '#/components/ui/button'
import { ClassroomForm } from '#/routes/_authed/classrooms/-classroom-form'

export const Route = createFileRoute('/_authed/classrooms/new')({
  beforeLoad: ({ context }) => {
    // Creating classrooms is admin-only (DESIGN.md role matrix).
    if (context.session.user.role !== 'admin') {
      throw redirect({ to: '/classrooms' })
    }
  },
  component: NewClassroomPage,
})

function NewClassroomPage() {
  const navigate = Route.useNavigate()
  const createClassroom = useCreateClassroom()

  return (
    <div className="space-y-8">
      <PageHeader kicker="Classrooms" title="Add New Classroom" />
      <ClassroomForm
        heading="New Classroom Form"
        description="Add new classroom for the daycare"
        submitLabel="Submit"
        pending={createClassroom.isPending}
        cancel={
          <Button type="button" variant="outline" asChild>
            <Link to="/classrooms">Cancel</Link>
          </Button>
        }
        onSubmit={(values) => {
          createClassroom.mutate(values, {
            onSuccess: () => void navigate({ to: '/classrooms' }),
          })
        }}
      />
    </div>
  )
}
