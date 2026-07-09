import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'
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
    <FieldSet className={cn('gap-5', className)}>
      <FieldLegend className="mb-0">
        {kicker ? <span className="island-kicker block">{kicker}</span> : null}
        <span className="display-title mt-1 block text-xl font-semibold text-[var(--sea-ink)]">
          {title}
        </span>
      </FieldLegend>
      {description ? (
        <FieldDescription className="text-[var(--sea-ink-soft)]">
          {description}
        </FieldDescription>
      ) : null}
      <FieldGroup
        className={cn('grid gap-5', columns === 2 && 'sm:grid-cols-2')}
      >
        {children}
      </FieldGroup>
    </FieldSet>
  )
}
