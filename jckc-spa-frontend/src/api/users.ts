import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { get, patch, post } from '#/api/client'
import { keys } from '#/api/keys'
import type { ApiError } from '#/api/client'
import type { UserListParams } from '#/api/keys'
import type {
  Paginated,
  RegisterUserBody,
  UpdateMeBody,
  UpdateUserRoleBody,
  UserDto,
} from '#/api/types'

export function useMe() {
  return useQuery({
    queryKey: keys.users.me(),
    queryFn: () => get<UserDto>('/api/users/me'),
  })
}

export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateMeBody) => patch<UserDto>('/api/users/me', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.users.all })
      toast.success('Profile updated')
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

/**
 * POST /api/users/register — completes the in-app registration for the
 * authenticated user. Success toast/navigation is handled by the caller
 * (the register page also refetches the better-auth session).
 */
export function useRegisterUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterUserBody) =>
      post<UserDto>('/api/users/register', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.users.all })
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}

// ---------------------------------------------------------------------------
// Admin user management (GET /api/users, PATCH /api/users/:id)
// ---------------------------------------------------------------------------

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: keys.users.list(params),
    queryFn: () =>
      get<Paginated<UserDto>>(
        `/api/users?page=${params.page}&search=${encodeURIComponent(params.search)}`,
      ),
    // Keep the previous page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserRoleBody & { id: string }) =>
      patch<UserDto>(`/api/users/${id}`, body),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: keys.users.all })
      toast.success(`Role updated for ${user.name || user.email}`)
    },
    onError: (error: ApiError) => {
      toast.error(error.message)
    },
  })
}
