import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

export type StatusPillStatus = 'active' | 'inactive' | 'pending'

const CONFIG: Record<StatusPillStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'pill-palm' },
  inactive: { label: 'Inactive', className: 'pill-neutral' },
  pending: { label: 'Pending', className: 'pill-amber' },
}

/**
 * Status pill with legacy semantics: Active = assigned to a classroom (palm
 * tint), Inactive = unassigned (neutral), Pending = unapproved parent
 * application (amber).
 */
export function StatusPill({
  status,
  className,
}: {
  status: StatusPillStatus
  className?: string
}) {
  const config = CONFIG[status]
  return (
    <Badge
      variant="outline"
      className={cn('pill', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
