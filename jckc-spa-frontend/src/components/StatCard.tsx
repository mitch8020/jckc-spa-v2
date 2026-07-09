import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
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
    <Card
      className={cn(
        'island-shell feature-card rise-in rounded-2xl py-0',
        className,
      )}
      style={style}
    >
      {/* <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 pt-5 pb-0">
        <CardDescription className="island-kicker">{label}</CardDescription>
      </CardHeader> */}
      <CardContent className="px-5 pt-5 pb-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="display-title text-3xl font-semibold text-[var(--sea-ink)]">
            {value}
          </CardTitle>
          {icon ? (
            <span className="text-[var(--lagoon-deep)] [&_svg]:size-4">
              {icon}
            </span>
          ) : null}
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
