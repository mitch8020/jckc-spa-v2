import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, del, get, patch, post } from '#/api/client'
import { keys } from '#/api/keys'
import type { StudentListParams } from '#/api/keys'
import type {
  CreateStudentBody,
  GuardianForStudentDto,
  MyStudentsDto,
  Paginated,
  StudentDto,
  UpdateStudentBody,
} from '#/api/types'

function listQueryString(params: StudentListParams): string {
  return new URLSearchParams({
    page: String(params.page),
    status: params.status,
    search: params.search,
    order: params.order,
  }).toString()
}

/** Don't retry 4xx responses (403 wrong role, 404 unknown id, ...). */
function retryUnlessClientError(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 3
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** GET /api/students — admin/teacher paginated summary list. */
export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: keys.students.list(params),
    queryFn: () =>
      get<Paginated<StudentDto>>(`/api/students?${listQueryString(params)}`),
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  })
}

/** GET /api/students/mine — the parent's own registered + pending students. */
export function useMyStudents() {
  return useQuery({
    queryKey: keys.students.mine(),
    queryFn: () => get<MyStudentsDto>('/api/students/mine'),
    retry: retryUnlessClientError,
  })
}

/** GET /api/students/:id — admin/teacher. */
export function useStudent(id: string) {
  return useQuery({
    queryKey: keys.students.detail(id),
    queryFn: () => get<StudentDto>(`/api/students/${id}`),
    retry: retryUnlessClientError,
  })
}

/** GET /api/students/:id/guardians — guardians linked to this student. */
export function useStudentGuardians(id: string) {
  return useQuery({
    queryKey: keys.students.guardiansOf(id),
    queryFn: () =>
      get<GuardianForStudentDto[]>(`/api/students/${id}/guardians`),
    retry: retryUnlessClientError,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * POST /api/students — success toast + navigation are handled by the caller
 * (the message differs between admin registration and parent application).
 */
export function useCreateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateStudentBody) =>
      post<StudentDto>('/api/students', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.students.all })
      await queryClient.invalidateQueries({ queryKey: keys.guardians.all })
      await queryClient.invalidateQueries({ queryKey: keys.classrooms.all })
      await queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/** PATCH /api/students/:id — the edit-form update (any subset of the 7 fields). */
export function useUpdateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateStudentBody & { id: string }) =>
      patch<StudentDto>(`/api/students/${id}`, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.students.all })
      await queryClient.invalidateQueries({ queryKey: keys.classrooms.all })
      await queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
      toast.success('Student info updated')
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/** PATCH /api/students/:id `{ applicationApprovalStatus: true }` — admin quick approve. */
export function useApproveStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      patch<StudentDto>(`/api/students/${id}`, {
        applicationApprovalStatus: true,
      }),
    onSuccess: async (student) => {
      await queryClient.invalidateQueries({ queryKey: keys.students.all })
      await queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
      toast.success(
        `${student.studentFirstName} ${student.studentLastName} approved`,
      )
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/**
 * DELETE /api/students/:id — cascades guardian-link removal server-side, so
 * guardian caches are invalidated too. `name` is only used for the toast.
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) =>
      del(`/api/students/${id}`),
    onSuccess: async (_, { name }) => {
      await queryClient.invalidateQueries({ queryKey: keys.students.all })
      await queryClient.invalidateQueries({ queryKey: keys.guardians.all })
      await queryClient.invalidateQueries({ queryKey: keys.classrooms.all })
      await queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
      toast.success(`${name} deleted`)
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}
