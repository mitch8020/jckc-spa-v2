import { ShellIcon } from 'lucide-react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
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
    <Empty
      className={cn(
        'gap-3 border-none bg-transparent px-6 py-14 text-center md:p-14',
        className,
      )}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--lagoon-deep)]"
        >
          <Icon aria-hidden />
        </EmptyMedia>
        {title ? (
          <EmptyTitle className="display-title text-lg font-semibold text-[var(--sea-ink)]">
            {title}
          </EmptyTitle>
        ) : null}
        <EmptyDescription className="max-w-sm text-[var(--sea-ink-soft)]">
          {message}
        </EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
