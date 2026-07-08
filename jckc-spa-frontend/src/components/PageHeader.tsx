import { cn } from '#/lib/utils'
import type { ReactNode } from 'react'

/**
 * Standard page heading: uppercase kicker eyebrow + display title,
 * with an optional right-aligned action slot (buttons/links).
 */
export function PageHeader({
  kicker,
  title,
  action,
  className,
}: {
  kicker: string
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rise-in flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div>
        <p className="island-kicker">{kicker}</p>
        <h1 className="display-title mt-1 text-3xl font-semibold text-[var(--sea-ink)] sm:text-4xl">
          {title}
        </h1>
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}
