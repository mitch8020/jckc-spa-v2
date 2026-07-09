import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { CircleAlertIcon, Trash2Icon } from 'lucide-react'
import {
  useClassroom,
  useDeleteClassroom,
  useUpdateClassroom,
} from '#/api/classrooms'
import { ApiError } from '#/api/client'
import { ConfirmDialog } from '#/components/ConfirmDialog'
import { EmptyState } from '#/components/EmptyState'
import { PageHeader } from '#/components/PageHeader'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { ClassroomForm } from '#/routes/_authed/classrooms/-classroom-form'

export const Route = createFileRoute('/_authed/classrooms/$classroomId_/edit')({
  beforeLoad: ({ context }) => {
    // Editing classrooms is admin-only (DESIGN.md role matrix).
    if (context.session.user.role !== 'admin') {
      throw redirect({ to: '/classrooms' })
    }
  },
  component: EditClassroomPage,
})

function EditClassroomPage() {
  const { classroomId } = Route.useParams()
  const navigate = Route.useNavigate()
  const detailQuery = useClassroom(classroomId)
  const updateClassroom = useUpdateClassroom()
  const deleteClassroom = useDeleteClassroom()

  if (detailQuery.isPending) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader kicker="Classrooms" title="Edit Classroom Details" />
        <SurfaceCard
          className="rise-in max-w-xl rounded-3xl p-6 sm:p-8"
          style={{ animationDelay: '80ms' }}
        >
          <Skeleton className="h-6 w-48" />
          <div className="mt-6 grid gap-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </SurfaceCard>
      </div>
    )
  }

  const detail = detailQuery.data
  if (!detail) {
    const error = detailQuery.error
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="flex flex-col gap-8">
        <PageHeader kicker="Classrooms" title="Edit Classroom Details" />
        <SurfaceCard className="rise-in rounded-3xl">
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
        </SurfaceCard>
      </div>
    )
  }

  const { classroom, students } = detail
  const studentNoun = `student${students.length === 1 ? '' : 's'}`

  const handleDelete = () => {
    deleteClassroom.mutate(classroomId, {
      onSuccess: () => void navigate({ to: '/classrooms' }),
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader kicker="Classrooms" title="Edit Classroom Details" />
      <ClassroomForm
        heading="Edit Classroom Info"
        description="Update a classroom's information"
        defaultValues={{
          classroomName: classroom.classroomName,
          ageGroup: classroom.ageGroup,
          teacherName: classroom.teacherName,
        }}
        submitLabel="Submit"
        pending={updateClassroom.isPending}
        cancel={
          <Button type="button" variant="outline" asChild>
            <Link to="/classrooms/$classroomId" params={{ classroomId }}>
              Cancel
            </Link>
          </Button>
        }
        onSubmit={(values) => {
          updateClassroom.mutate(
            { id: classroomId, ...values },
            {
              onSuccess: () =>
                void navigate({
                  to: '/classrooms/$classroomId',
                  params: { classroomId },
                }),
            },
          )
        }}
      />

      <SurfaceCard
        className="rise-in max-w-xl rounded-3xl p-6 sm:p-8"
        style={{ animationDelay: '160ms' }}
      >
        <p className="island-kicker">Danger zone</p>
        <h2 className="display-title mt-1 text-xl font-semibold text-[var(--sea-ink)]">
          Delete Classroom
        </h2>
        <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
          Deleting a classroom unassigns its students; their records are kept.
        </p>
        <div className="mt-4">
          <ConfirmDialog
            title={`Delete ${classroom.classroomName}?`}
            description={
              students.length > 0
                ? `This permanently deletes "${classroom.classroomName}". Its ${students.length} assigned ${studentNoun} will become unassigned — student records themselves are kept.`
                : `This permanently deletes "${classroom.classroomName}". No students are currently assigned.`
            }
            confirmLabel="Delete Classroom"
            loading={deleteClassroom.isPending}
            onConfirm={handleDelete}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon data-icon="inline-start" /> Delete Classroom
              </Button>
            }
          />
        </div>
      </SurfaceCard>
    </div>
  )
}
