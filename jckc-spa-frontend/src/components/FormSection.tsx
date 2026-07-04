import { cn } from '#/lib/utils'
import type { ReactNode } from 'react'

/**
 * Kicker-styled section heading for forms. Children render in a responsive
 * two-column grid — span a field across both with `className="sm:col-span-2"`
 * on the field wrapper, or pass `columns={1}` for a single column.
 */
export function FormSection({
  kicker,
  title,
  description,
  columns = 2,
  children,
  className,
}: {
  kicker?: string
  title: string
  description?: string
  columns?: 1 | 2
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-5', className)}>
      <div>
        {kicker ? <p className="island-kicker">{kicker}</p> : null}
        <h2 className="display-title mt-1 text-xl font-semibold text-[var(--sea-ink)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className={cn('grid gap-5', columns === 2 && 'sm:grid-cols-2')}>
        {children}
      </div>
    </section>
  )
}
