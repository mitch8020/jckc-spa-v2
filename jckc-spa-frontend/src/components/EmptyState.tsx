import { ShellIcon } from 'lucide-react'
import { cn } from '#/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Friendly empty state: soft chip-styled lucide icon + message, with an
 * optional title and action. Drop inside table bodies (full-width cell) or
 * card grids when there is nothing to show.
 */
export function EmptyState({
  icon: Icon = ShellIcon,
  title,
  message,
  action,
  className,
}: {
  icon?: LucideIcon
  title?: string
  message: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--lagoon-deep)]">
        <Icon className="size-6" aria-hidden />
      </span>
      {title ? (
        <p className="display-title mt-1 text-lg font-semibold text-[var(--sea-ink)]">
          {title}
        </p>
      ) : null}
      <p className="max-w-sm text-sm text-[var(--sea-ink-soft)]">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
