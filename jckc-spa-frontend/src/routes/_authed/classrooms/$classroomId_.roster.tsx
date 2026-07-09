import { useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { CircleAlertIcon, UsersRoundIcon } from 'lucide-react'
import {
  useAssignRosterStudents,
  useClassroom,
  useClassroomRoster,
  useRemoveRosterStudents,
} from '#/api/classrooms'
import { AgeGroupBadge } from '#/components/AgeGroupBadge'
import { EmptyState } from '#/components/EmptyState'
import { PageHeader } from '#/components/PageHeader'
import { PaginationBar } from '#/components/PaginationBar'
import { SearchInput } from '#/components/SearchInput'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'
import { convertAge } from '#/lib/age'
import { cn } from '#/lib/utils'
import type { SearchSchemaInput } from '@tanstack/react-router'
import type { RosterParams } from '#/api/keys'
import type { Paginated, StudentDto } from '#/api/types'

function toPage(value: unknown): number {
  // Legacy parity: non-numeric / zero / negative → 1.
  const page = Math.floor(Number(value))
  return Number.isFinite(page) && page >= 1 ? page : 1
}

function toSearchTerm(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export const Route = createFileRoute(
  '/_authed/classrooms/$classroomId_/roster',
)({
  // Legacy query param names preserved verbatim (ui-layout.md §6):
  // addPage / addSearch / removePage / removeSearch.
  validateSearch: (
    search: Record<string, unknown> & SearchSchemaInput,
  ): RosterParams => ({
    addPage: toPage(search.addPage),
    addSearch: toSearchTerm(search.addSearch),
    removePage: toPage(search.removePage),
    removeSearch: toSearchTerm(search.removeSearch),
  }),
  beforeLoad: ({ context }) => {
    // Roster editing is admin-only (API-CONTRACT.md).
    if (context.session.user.role !== 'admin') {
      throw redirect({ to: '/classrooms' })
    }
  },
  component: RosterPage,
})

/** Immutable set update for a pane's selection. */
function updateSelection(
  prev: ReadonlySet<string>,
  id: string,
  checked: boolean,
): ReadonlySet<string> {
  const next = new Set(prev)
  if (checked) next.add(id)
  else next.delete(id)
  return next
}

function RosterPage() {
  const { classroomId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const classroomQuery = useClassroom(classroomId)
  const rosterQuery = useClassroomRoster(classroomId, search)
  const assignStudents = useAssignRosterStudents()
  const removeStudents = useRemoveRosterStudents()

  // Selections persist across page/search changes within each pane — the SPA
  // equivalent of the legacy per-classroom sessionStorage keys. Cleared only
  // on submit or via each pane's Clear button.
  const [addSelected, setAddSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [removeSelected, setRemoveSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const classroom = classroomQuery.data?.classroom

  if (classroomQuery.isError || rosterQuery.isError) {
    const message =
      classroomQuery.error?.message ??
      rosterQuery.error?.message ??
      'Unable to load the classroom roster.'
    return (
      <div className="flex flex-col gap-8">
        <PageHeader kicker="Classroom roster" title="Add / Remove Students" />
        <SurfaceCard className="rise-in rounded-3xl">
          <EmptyState
            icon={CircleAlertIcon}
            title="Something went wrong"
            message={message}
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

  // Search changes reset that pane to page 1; the other pane's page and
  // search are always preserved (legacy URL semantics).
  const handleAddSearch = (value: string) =>
    void navigate({
      search: (prev) => ({ ...prev, addSearch: value, addPage: 1 }),
      replace: true,
    })
  const handleRemoveSearch = (value: string) =>
    void navigate({
      search: (prev) => ({ ...prev, removeSearch: value, removePage: 1 }),
      replace: true,
    })
  const handleAddPage = (page: number) =>
    void navigate({ search: (prev) => ({ ...prev, addPage: page }) })
  const handleRemovePage = (page: number) =>
    void navigate({ search: (prev) => ({ ...prev, removePage: page }) })

  const handleAdd = () => {
    assignStudents.mutate(
      { id: classroomId, studentIds: Array.from(addSelected) },
      { onSuccess: () => setAddSelected(new Set()) },
    )
  }
  const handleRemove = () => {
    removeStudents.mutate(
      { id: classroomId, studentIds: Array.from(removeSelected) },
      { onSuccess: () => setRemoveSelected(new Set()) },
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        kicker="Classroom roster"
        title="Add / Remove Students"
        action={
          <Button variant="outline" asChild>
            <Link to="/classrooms/$classroomId" params={{ classroomId }}>
              Cancel
            </Link>
          </Button>
        }
      />

      <div
        className="rise-in flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-[var(--sea-ink-soft)]"
        style={{ animationDelay: '60ms' }}
      >
        <p className="flex items-baseline gap-2">
          Classroom:{' '}
          {classroom ? (
            <span className="display-title text-base font-semibold text-[var(--sea-ink)]">
              {classroom.classroomName}
            </span>
          ) : (
            <Skeleton className="h-5 w-32" />
          )}
        </p>
        <p className="flex items-center gap-2">
          Age Group:{' '}
          {classroom ? (
            <AgeGroupBadge ageGroup={classroom.ageGroup} />
          ) : (
            <Skeleton className="h-5 w-16" />
          )}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <RosterPane
          idPrefix="add"
          title="Add Students"
          description="Unassigned students"
          pane={rosterQuery.data?.add}
          loading={rosterQuery.isPending}
          fetching={rosterQuery.isFetching}
          searchValue={search.addSearch}
          onSearchChange={handleAddSearch}
          onPageChange={handleAddPage}
          selected={addSelected}
          onToggle={(id, checked) =>
            setAddSelected((prev) => updateSelection(prev, id, checked))
          }
          onClearSelection={() => setAddSelected(new Set())}
          submitLabel="Add"
          submitPending={assignStudents.isPending}
          onSubmit={handleAdd}
          animationDelay="120ms"
        />
        <RosterPane
          idPrefix="remove"
          title="Remove Students"
          description="Students in this classroom"
          pane={rosterQuery.data?.remove}
          loading={rosterQuery.isPending}
          fetching={rosterQuery.isFetching}
          searchValue={search.removeSearch}
          onSearchChange={handleRemoveSearch}
          onPageChange={handleRemovePage}
          selected={removeSelected}
          onToggle={(id, checked) =>
            setRemoveSelected((prev) => updateSelection(prev, id, checked))
          }
          onClearSelection={() => setRemoveSelected(new Set())}
          submitLabel="Remove"
          submitPending={removeStudents.isPending}
          onSubmit={handleRemove}
          animationDelay="180ms"
        />
      </div>
    </div>
  )
}

function RosterPane({
  idPrefix,
  title,
  description,
  pane,
  loading,
  fetching,
  searchValue,
  onSearchChange,
  onPageChange,
  selected,
  onToggle,
  onClearSelection,
  submitLabel,
  submitPending,
  onSubmit,
  animationDelay,
}: {
  idPrefix: string
  title: string
  description: string
  pane: Paginated<StudentDto> | undefined
  loading: boolean
  fetching: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  selected: ReadonlySet<string>
  onToggle: (id: string, checked: boolean) => void
  onClearSelection: () => void
  submitLabel: string
  submitPending: boolean
  onSubmit: () => void
  animationDelay: string
}) {
  return (
    <SurfaceCard
      className="rise-in flex flex-col overflow-hidden rounded-3xl py-0"
      style={{ animationDelay }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <div>
          <h2 className="display-title text-lg font-semibold text-[var(--sea-ink)]">
            {title}
          </h2>
          <p className="text-xs text-[var(--sea-ink-soft)]">{description}</p>
        </div>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="pill pill-lagoon">
              {selected.size} selected
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <SearchInput value={searchValue} onChange={onSearchChange} />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] px-5 py-4">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : !pane || pane.items.length === 0 ? (
        <EmptyState
          icon={UsersRoundIcon}
          message={
            searchValue
              ? 'No students match your search'
              : 'No Students Available'
          }
          className="border-t border-[var(--line)] py-10"
        />
      ) : (
        <FieldGroup
          className={cn(
            'gap-0 divide-y divide-[var(--line)] border-t border-[var(--line)] transition-opacity',
            fetching && 'opacity-60',
          )}
        >
          {pane.items.map((student) => (
            <Field
              key={student.id}
              orientation="horizontal"
              className="justify-between gap-3 px-5 py-2.5 text-sm hover:bg-[var(--link-bg-hover)]"
            >
              <FieldLabel
                htmlFor={`${idPrefix}-${student.id}`}
                className="min-w-0 flex-1 cursor-pointer"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-[var(--sea-ink)]">
                    {student.studentFirstName} {student.studentLastName}
                  </span>
                  <span className="text-[var(--sea-ink-soft)]">
                    , {convertAge(student.dateOfBirth)}
                  </span>
                </span>
              </FieldLabel>
              <Checkbox
                id={`${idPrefix}-${student.id}`}
                checked={selected.has(student.id)}
                onCheckedChange={(checked) =>
                  onToggle(student.id, checked === true)
                }
              />
            </Field>
          ))}
        </FieldGroup>
      )}

      {pane ? (
        <PaginationBar
          pagination={pane.pagination}
          onPageChange={onPageChange}
        />
      ) : null}

      {/* Always rendered (fixes legacy quirk 18: the submit button vanished
          when a search had 0 matches even with off-page selections). */}
      <div className="mt-auto flex items-center justify-end gap-3 border-t border-[var(--line)] px-5 py-4">
        <Button
          type="button"
          onClick={onSubmit}
          disabled={selected.size === 0 || submitPending}
        >
          {submitPending ? 'Working…' : submitLabel}
        </Button>
      </div>
    </SurfaceCard>
  )
}
