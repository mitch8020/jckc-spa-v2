import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { UsersRoundIcon } from 'lucide-react'
import { useUpdateUserRole, useUsers } from '#/api/users'
import { ConfirmDialog } from '#/components/ConfirmDialog'
import {
  TableSkeletonRows,
  tableCellClass,
  tableHeadClass,
} from '#/components/DataTable'
import { EmptyState } from '#/components/EmptyState'
import { PageHeader } from '#/components/PageHeader'
import { PaginationBar } from '#/components/PaginationBar'
import { SearchInput } from '#/components/SearchInput'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'
import { useSessionUser } from '#/lib/session'
import type { SearchSchemaInput } from '@tanstack/react-router'
import type { RegisteredRole, UserDto } from '#/api/types'

interface UsersSearch {
  page: number
  search: string
}

export const Route = createFileRoute('/_authed/users')({
  // SearchSchemaInput marker: links to /users never need an explicit `search`
  // prop (same pattern as the students list and roster routes).
  validateSearch: (
    search: Record<string, unknown> & SearchSchemaInput,
  ): UsersSearch => ({
    page: Math.max(1, Math.floor(Number(search.page)) || 1),
    search: typeof search.search === 'string' ? search.search : '',
  }),
  beforeLoad: ({ context }) => {
    // User administration is strictly admin-only.
    if (context.session.user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: UsersPage,
})

// Partial: an unregistered user's role is '' and has no pill entry.
const ROLE_PILL: Partial<Record<string, { label: string; className: string }>> =
  {
    admin: { label: 'Admin', className: 'pill-lagoon' },
    teacher: { label: 'Teacher', className: 'pill-palm' },
    parent: { label: 'Parent', className: 'pill-amber' },
  }

function formatJoined(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function UsersPage() {
  const me = useSessionUser()
  const navigate = Route.useNavigate()
  const { page, search } = Route.useSearch()

  const usersQuery = useUsers({ page, search })
  const updateRole = useUpdateUserRole()

  const [pendingChange, setPendingChange] = useState<{
    user: UserDto
    role: RegisteredRole
  } | null>(null)

  const handleSearchChange = (value: string) => {
    // Changing the search always resets to page 1 (legacy URL semantics).
    void navigate({ search: { page: 1, search: value } })
  }

  const handlePageChange = (nextPage: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: nextPage }) })
  }

  const handleRoleChange = (target: UserDto, nextRole: RegisteredRole) => {
    if (nextRole === target.role) return
    // Granting or revoking admin deserves an explicit confirmation.
    if (nextRole === 'admin' || target.role === 'admin') {
      setPendingChange({ user: target, role: nextRole })
      return
    }
    updateRole.mutate({ id: target.id, role: nextRole })
  }

  const confirmRoleChange = () => {
    if (!pendingChange) return
    updateRole.mutate(
      { id: pendingChange.user.id, role: pendingChange.role },
      { onSettled: () => setPendingChange(null) },
    )
  }

  const data = usersQuery.data
  const grantingAdmin = pendingChange?.role === 'admin'
  const pendingName = pendingChange
    ? [pendingChange.user.firstName, pendingChange.user.lastName]
        .filter(Boolean)
        .join(' ') ||
      pendingChange.user.name ||
      pendingChange.user.email
    : ''

  return (
    <div className="space-y-8">
      <PageHeader kicker="Administration" title="User Accounts" />

      <div className="rise-in" style={{ animationDelay: '60ms' }}>
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or email..."
          className="max-w-sm"
        />
      </div>

      <div
        className="island-shell rise-in overflow-hidden rounded-3xl"
        style={{ animationDelay: '120ms' }}
      >
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--line)] hover:bg-transparent">
              <TableHead className={tableHeadClass}>User</TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden md:table-cell')}>
                Email
              </TableHead>
              <TableHead className={tableHeadClass}>Role</TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden sm:table-cell')}>
                Registered
              </TableHead>
              <TableHead className={cn(tableHeadClass, 'hidden lg:table-cell')}>
                Joined
              </TableHead>
              <TableHead className={cn(tableHeadClass, 'text-right')}>
                Change role
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data ? (
              data.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={UsersRoundIcon}
                      message={
                        search
                          ? `No users match "${search}".`
                          : 'No user accounts yet.'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isSelf={user.id === me.id}
                    disabled={updateRole.isPending}
                    onRoleChange={handleRoleChange}
                  />
                ))
              )
            ) : usersQuery.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={UsersRoundIcon}
                    title="Couldn't load users"
                    message={usersQuery.error.message}
                  />
                </TableCell>
              </TableRow>
            ) : (
              <TableSkeletonRows columnCount={6} />
            )}
          </TableBody>
        </Table>

        {data ? (
          <PaginationBar
            pagination={data.pagination}
            noun="users"
            onPageChange={handlePageChange}
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null)
        }}
        title={grantingAdmin ? 'Grant admin access?' : 'Revoke admin access?'}
        description={
          pendingChange
            ? grantingAdmin
              ? `${pendingName} will get full administrator access: students, classrooms, guardians, reports and user management.`
              : `${pendingName} will lose administrator access and become a ${pendingChange.role}.`
            : ''
        }
        confirmLabel={grantingAdmin ? 'Grant admin' : 'Revoke admin'}
        loading={updateRole.isPending}
        onConfirm={confirmRoleChange}
      />
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  disabled,
  onRoleChange,
}: {
  user: UserDto
  isSelf: boolean
  disabled: boolean
  onRoleChange: (user: UserDto, role: RegisteredRole) => void
}) {
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.name ||
    user.email
  const initial = (user.firstName || user.name || user.email || '?')
    .charAt(0)
    .toUpperCase()
  const rolePill = ROLE_PILL[user.role]

  return (
    <TableRow className="border-[var(--line)] hover:bg-[var(--link-bg-hover)]">
      <TableCell className={tableCellClass}>
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border border-[var(--line)]">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="bg-[var(--chip-bg)] font-bold text-[var(--lagoon-deep)]">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="max-w-40 truncate font-semibold text-[var(--sea-ink)] sm:max-w-56">
                {displayName}
              </p>
              {isSelf ? <span className="pill pill-lagoon">You</span> : null}
            </div>
            <p className="max-w-40 truncate text-xs text-[var(--sea-ink-soft)] md:hidden">
              {user.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell
        className={cn(
          tableCellClass,
          'hidden text-[var(--sea-ink-soft)] md:table-cell',
        )}
      >
        {user.email}
      </TableCell>
      <TableCell className={tableCellClass}>
        {rolePill ? (
          <span className={cn('pill', rolePill.className)}>
            {rolePill.label}
          </span>
        ) : (
          <span className="pill pill-neutral">No role</span>
        )}
      </TableCell>
      <TableCell className={cn(tableCellClass, 'hidden sm:table-cell')}>
        <span
          className={cn(
            'pill',
            user.registrationStatus ? 'pill-palm' : 'pill-amber',
          )}
        >
          {user.registrationStatus ? 'Registered' : 'Pending'}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          tableCellClass,
          'hidden text-[var(--sea-ink-soft)] lg:table-cell',
        )}
      >
        {formatJoined(user.createdAt)}
      </TableCell>
      <TableCell className={cn(tableCellClass, 'text-right')}>
        <div
          className="inline-block"
          title={
            isSelf
              ? 'You cannot change your own role — ask another admin.'
              : undefined
          }
        >
          {/* Controlled by server data: '' matches no item → placeholder. */}
          <Select
            value={user.role}
            onValueChange={(value) =>
              onRoleChange(user, value as RegisteredRole)
            }
            disabled={isSelf || disabled}
          >
            <SelectTrigger
              size="sm"
              className="w-30"
              aria-label={`Change role for ${displayName}`}
            >
              <SelectValue placeholder="No role" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TableCell>
    </TableRow>
  )
}
