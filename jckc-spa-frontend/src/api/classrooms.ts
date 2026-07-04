import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { del, get, patch, post } from '#/api/client'
import { keys } from '#/api/keys'
import type { QueryClient } from '@tanstack/react-query'
import type { ApiError } from '#/api/client'
import type { RosterParams } from '#/api/keys'
import type {
  ClassroomDetailDto,
  ClassroomDto,
  ClassroomInput,
  ClassroomRosterDto,
  ClassroomWithCountDto,
  RosterAssignResultDto,
  RosterRemoveResultDto,
} from '#/api/types'

const plural = (count: number) => (count === 1 ? '' : 's')

/**
 * Classroom changes ripple beyond the classrooms cache: student rows embed
 * their populated classroom, and the dashboard aggregates both.
 */
async function invalidateClassroomData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.classrooms.all }),
    queryClient.invalidateQueries({ queryKey: keys.students.all }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard.all }),
  ])
}

/** GET /api/classrooms — already sorted by age-group rank then name. */
export function useClassrooms() {
  return useQuery({
    queryKey: keys.classrooms.list(),
    queryFn: () => get<ClassroomWithCountDto[]>('/api/classrooms'),
  })
}

/** GET /api/classrooms/:id — classroom + its students (first-name sorted). */
export function useClassroom(id: string) {
  return useQuery({
    queryKey: keys.classrooms.detail(id),
    queryFn: () => get<ClassroomDetailDto>(`/api/classrooms/${id}`),
  })
}

/**
 * GET /api/classrooms/:id/roster — one query for both roster-editor panes,
 * keyed by all four pane params. Previous data is kept as placeholder so
 * paging/searching one pane doesn't blank the other.
 */
export function useClassroomRoster(id: string, params: RosterParams) {
  return useQuery({
    queryKey: keys.classrooms.roster(id, params),
    queryFn: () =>
      get<ClassroomRosterDto>(
        `/api/classrooms/${id}/roster?addPage=${params.addPage}&addSearch=${encodeURIComponent(
          params.addSearch,
        )}&removePage=${params.removePage}&removeSearch=${encodeURIComponent(
          params.removeSearch,
        )}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useCreateClassroom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ClassroomInput) =>
      post<ClassroomDto>('/api/classrooms', body),
    onSuccess: async (classroom) => {
      await invalidateClassroomData(queryClient)
      toast.success(`Classroom "${classroom.classroomName}" created`)
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateClassroom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ClassroomInput & { id: string }) =>
      patch<ClassroomDto>(`/api/classrooms/${id}`, body),
    onSuccess: async () => {
      await invalidateClassroomData(queryClient)
      toast.success('Classroom info updated')
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/**
 * DELETE /api/classrooms/:id — the backend unassigns the classroom's
 * students. Invalidation is deliberately NOT awaited: the caller navigates
 * away immediately and the deleted classroom's own detail refetch would 404.
 */
export function useDeleteClassroom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/api/classrooms/${id}`),
    onSuccess: () => {
      void invalidateClassroomData(queryClient)
      toast.success('Classroom deleted — its students are now unassigned')
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/** POST /api/classrooms/:id/students — assign students to the classroom. */
export function useAssignRosterStudents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, studentIds }: { id: string; studentIds: string[] }) =>
      post<RosterAssignResultDto>(`/api/classrooms/${id}/students`, {
        studentIds,
      }),
    onSuccess: async (result) => {
      await invalidateClassroomData(queryClient)
      toast.success(
        `${result.added} student${plural(result.added)} added to classroom`,
      )
      if (result.notFound.length > 0) {
        toast.warning(
          `Skipped ${result.notFound.length} selected student${plural(
            result.notFound.length,
          )} that no longer exist`,
        )
      }
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/** POST /api/classrooms/:id/students/remove — unassign the classroom's students. */
export function useRemoveRosterStudents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, studentIds }: { id: string; studentIds: string[] }) =>
      post<RosterRemoveResultDto>(`/api/classrooms/${id}/students/remove`, {
        studentIds,
      }),
    onSuccess: async (result) => {
      await invalidateClassroomData(queryClient)
      toast.success(
        `${result.removed} student${plural(result.removed)} removed from classroom`,
      )
      if (result.skipped.length > 0) {
        toast.warning(
          `Skipped ${result.skipped.length} student${plural(
            result.skipped.length,
          )} not in this classroom`,
        )
      }
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}
