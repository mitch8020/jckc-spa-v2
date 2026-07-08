import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { Pagination } from '#/api/types'

/**
 * Legacy-parity pagination footer: "Showing X to Y of Z {noun}" (sm+ only),
 * "Page X of Y", Previous/Next only (no numbered pages). Renders nothing at
 * all when totalCount is 0. Driven entirely by the Pagination DTO; the
 * caller navigates (updating its route search params) on page change.
 */
export function PaginationBar({
  pagination,
  noun = 'students',
  onPageChange,
  pending = false,
  pendingPage,
  className,
}: {
  pagination: Pagination
  noun?: string
  onPageChange: (page: number) => void
  pending?: boolean
  pendingPage?: number
  className?: string
}) {
  if (pagination.totalCount === 0) return null

  const previousPage = pagination.currentPage - 1
  const nextPage = pagination.currentPage + 1
  const pendingLabel = pendingPage
    ? `Loading page ${pendingPage}`
    : 'Updating table'

  return (
    <div
      aria-busy={pending}
      className={cn(
        'flex items-center justify-between gap-4 border-t border-[var(--line)] px-4 py-3 sm:px-6',
        className,
      )}
    >
      <div className="hidden min-w-0 text-sm text-[var(--sea-ink-soft)] sm:block">
        <p>
          Showing{' '}
          <span className="font-semibold text-[var(--sea-ink)]">
            {pagination.startIndex}
          </span>{' '}
          to{' '}
          <span className="font-semibold text-[var(--sea-ink)]">
            {pagination.endIndex}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-[var(--sea-ink)]">
            {pagination.totalCount}
          </span>{' '}
          {noun}
        </p>
      </div>
      <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none sm:justify-end">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Page {pagination.currentPage} of {pagination.totalPages}
          </p>
          {pending ? (
            <p
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--lagoon-deep)]"
            >
              <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />
              Updating
              <span className="sr-only">{pendingLabel}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !pagination.hasPrevious}
            onClick={() => onPageChange(previousPage)}
            aria-label={
              pagination.hasPrevious
                ? `Previous page, page ${previousPage}`
                : 'Previous page unavailable'
            }
          >
            <ChevronLeftIcon />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !pagination.hasNext}
            onClick={() => onPageChange(nextPage)}
            aria-label={
              pagination.hasNext
                ? `Next page, page ${nextPage}`
                : 'Next page unavailable'
            }
          >
            Next
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
