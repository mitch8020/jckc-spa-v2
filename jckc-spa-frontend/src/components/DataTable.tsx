import { Skeleton } from '#/components/ui/skeleton'
import { TableCell, TableRow } from '#/components/ui/table'

/**
 * Shared data-table typography (the "DataTable helpers" of DESIGN.md's
 * frontend layout): every list table in the app uses the same header
 * size/tracking/color and cell padding. Pages compose these with cn() for
 * responsive visibility or alignment tweaks.
 */
export const tableHeadClass =
  'h-auto px-4 py-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--sea-ink-soft)] sm:px-6'

export const tableCellClass = 'px-4 py-3.5 sm:px-6'

/** Uniform table loading state: full-width skeleton rows. */
export function TableSkeletonRows({
  columnCount,
  rows = 5,
}: {
  columnCount: number
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow
          key={row}
          className="border-[var(--line)] hover:bg-transparent"
        >
          <TableCell colSpan={columnCount} className={tableCellClass}>
            <Skeleton className="h-5 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
