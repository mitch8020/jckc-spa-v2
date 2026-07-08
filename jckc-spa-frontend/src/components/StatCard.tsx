import { cn } from '#/lib/utils'
import type { CSSProperties, ReactNode } from 'react'

/**
 * Dashboard stat tile. Stagger entrances on grids via
 * `style={{ animationDelay: `${index * 60}ms` }}` combined with `rise-in`.
 */
export function StatCard({
  label,
  value,
  icon,
  hint,
  className,
  style,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={cn(
        'island-shell feature-card rise-in rounded-2xl p-5 flex flex-col justify-between gap-1',
        className,
      )}
      style={style}
    >
      <div className="flex items-center justify-between gap-3 grow">
        <p className="island-kicker">{label}</p>
        {icon ? (
          <span className="text-[var(--lagoon-deep)] [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <div>
      <p className="display-title mt-2 text-3xl font-semibold text-[var(--sea-ink)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">{hint}</p>
      ) : null}
      </div>
    </div>
  )
}
