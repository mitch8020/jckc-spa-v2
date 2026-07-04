import type { SortOrder, StudentStatusFilter } from '#/api/types'

export interface StudentListParams {
  page: number
  status: StudentStatusFilter
  search: string
  order: SortOrder
}

export interface RosterParams {
  addPage: number
  addSearch: string
  removePage: number
  removeSearch: string
}

export interface UserListParams {
  page: number
  search: string
}

/**
 * Central react-query key factory. Mutations invalidate by prefix, e.g.
 * `queryClient.invalidateQueries({ queryKey: keys.students.all })` wipes the
 * list, detail, mine and guardians-of caches at once.
 */
export const keys = {
  students: {
    all: ['students'] as const,
    list: (params: StudentListParams) => ['students', 'list', params] as const,
    detail: (id: string) => ['students', 'detail', id] as const,
    mine: () => ['students', 'mine'] as const,
    guardiansOf: (id: string) =>
      ['students', 'detail', id, 'guardians'] as const,
  },
  classrooms: {
    all: ['classrooms'] as const,
    list: () => ['classrooms', 'list'] as const,
    detail: (id: string) => ['classrooms', 'detail', id] as const,
    roster: (id: string, params: RosterParams) =>
      ['classrooms', 'detail', id, 'roster', params] as const,
  },
  guardians: {
    all: ['guardians'] as const,
    list: () => ['guardians', 'list'] as const,
    detail: (id: string) => ['guardians', 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params: UserListParams) => ['users', 'list', params] as const,
    me: () => ['users', 'me'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
  },
}
