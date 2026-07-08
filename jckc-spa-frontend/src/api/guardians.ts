import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { del, get, patch, post } from '#/api/client'
import { keys } from '#/api/keys'
import type { ApiError } from '#/api/client'
import type {
  AddGuardianToStudentBody,
  GuardianDto,
  GuardianSummaryDto,
  StudentDto,
  UpdateGuardianBody,
} from '#/api/types'

/**
 * GET /api/guardians — summary rows for the "add guardian to a student"
 * picker, sorted by first name (case-insensitive) server-side.
 */
export function useGuardians(enabled = true) {
  return useQuery({
    queryKey: keys.guardians.list(),
    queryFn: () => get<GuardianSummaryDto[]>('/api/guardians'),
    enabled,
  })
}

/**
 * GET /api/guardians/:id — full guardian with resolved student links
 * (dangling legacy links come back with `student: null`). Pass `''` to keep
 * the query idle (used by the add page before a guardian is picked).
 */
export function useGuardian(id: string) {
  return useQuery({
    queryKey: keys.guardians.detail(id),
    queryFn: () => get<GuardianDto>(`/api/guardians/${id}`),
    enabled: id !== '',
  })
}

/**
 * GET /api/students/:id — the student a guardian is being added for (page
 * heading). Uses the students detail cache key, so it shares its cache entry
 * with the students feature's own detail hook.
 */
export function useStudentForGuardian(studentId: string) {
  return useQuery({
    queryKey: keys.students.detail(studentId),
    queryFn: () => get<StudentDto>(`/api/students/${studentId}`),
  })
}

/**
 * PATCH /api/guardians/:id — full-replace of the 7 personal fields plus
 * optional relationship/pickup edits for resolved links (dangling links are
 * preserved server-side).
 */
export function useUpdateGuardian() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateGuardianBody & { id: string }) =>
      patch<GuardianDto>(`/api/guardians/${id}`, body),
    onSuccess: async () => {
      // Guardian info/relationships also surface on student detail pages.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.guardians.all }),
        queryClient.invalidateQueries({ queryKey: keys.students.all }),
      ])
      toast.success('Guardian info updated')
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/** DELETE /api/guardians/:id — removes the guardian and all their links. */
export function useDeleteGuardian() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/api/guardians/${id}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.guardians.all }),
        queryClient.invalidateQueries({ queryKey: keys.students.all }),
      ])
      toast.success('Parent / guardian deleted')
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/**
 * DELETE /api/guardians/:id/students/:studentId — removes a single
 * guardian↔student link (also works for dangling legacy links).
 */
export function useRemoveGuardianLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      guardianId,
      studentId,
    }: {
      guardianId: string
      studentId: string
    }) => del(`/api/guardians/${guardianId}/students/${studentId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.guardians.all }),
        queryClient.invalidateQueries({ queryKey: keys.students.all }),
      ])
      toast.success('Student link removed')
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/**
 * POST /api/students/:studentId/guardians — links an existing guardian
 * (`guardianId`) or creates a new one (`guardian`) with the initial
 * relationship/pickup values. 409 = guardian already linked to this student.
 */
export function useAddGuardianToStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      studentId,
      ...body
    }: AddGuardianToStudentBody & { studentId: string }) =>
      post<GuardianDto>(`/api/students/${studentId}/guardians`, body),
    onSuccess: async (_guardian, { studentId, guardianId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.guardians.all }),
        // covers keys.students.guardiansOf(studentId) (nested under detail)
        queryClient.invalidateQueries({
          queryKey: keys.students.detail(studentId),
        }),
      ])
      toast.success(guardianId ? 'Guardian linked' : 'Parent / guardian added')
    },
    onError: (error: ApiError) => {
      toast.error(
        error.status === 409 ? 'Guardian already linked' : error.message,
      )
    },
  })
}
