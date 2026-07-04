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
  className,
}: {
  pagination: Pagination
  noun?: string
  onPageChange: (page: number) => void
  className?: string
}) {
  if (pagination.totalCount === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-t border-[var(--line)] px-4 py-3 sm:px-6',
        className,
      )}
    >
      <p className="hidden text-sm text-[var(--sea-ink-soft)] sm:block">
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
      <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none sm:justify-end">
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Page {pagination.currentPage} of {pagination.totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrevious}
            onClick={() => onPageChange(pagination.currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pagination.hasNext}
            onClick={() => onPageChange(pagination.currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
