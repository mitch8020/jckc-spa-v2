import { formatToday } from '#/lib/age'
import { cn } from '#/lib/utils'

/**
 * Legacy greeting header strip: "Hello, {firstName}!" left, today's date
 * (unpadded M/D/YYYY) right. Rendered by summary/detail pages only — edit
 * and registration pages omit it (ui-layout.md §1.1 rule).
 */
export function GreetingBar({
  firstName,
  className,
}: {
  firstName: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rise-in flex flex-wrap items-baseline justify-between gap-2',
        className,
      )}
    >
      <h2 className="display-title text-2xl font-semibold text-[var(--sea-ink)] sm:text-3xl">
        Hello, {firstName}!
      </h2>
      <p className="text-sm font-semibold tracking-wide text-[var(--sea-ink-soft)]">
        {formatToday()}
      </p>
    </div>
  )
}
