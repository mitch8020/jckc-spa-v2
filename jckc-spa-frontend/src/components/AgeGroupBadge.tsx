import { properNoun } from '#/lib/age'
import { cn } from '#/lib/utils'

const PILL_CLASS: Record<string, string> = {
  infant: 'pill-coral',
  toddler: 'pill-amber',
  preschool: 'pill-palm',
}

const BLOCK_BG: Record<string, string> = {
  infant: 'var(--age-infant)',
  toddler: 'var(--age-toddler)',
  preschool: 'var(--age-preschool)',
}

/**
 * Age-group identity badge. `pill` (default) renders a tinted pill with the
 * properNoun label ("Infant"/"Toddler"/"Preschool"); `block` renders the
 * legacy INF/TOD/PRE solid monogram block for classroom cards (size it via
 * className, e.g. `h-full w-14 rounded-l-2xl`).
 */
export function AgeGroupBadge({
  ageGroup,
  variant = 'pill',
  className,
}: {
  ageGroup: string | null | undefined
  variant?: 'pill' | 'block'
  className?: string
}) {
  const group = ageGroup ?? ''

  if (variant === 'block') {
    return (
      <span
        className={cn('monogram h-10 w-12 rounded-xl', className)}
        style={{ background: BLOCK_BG[group] ?? 'var(--sea-ink-soft)' }}
        aria-label={group ? properNoun(group) : 'No age group'}
      >
        {group ? group.substring(0, 3).toUpperCase() : '—'}
      </span>
    )
  }

  return (
    <span
      className={cn('pill', PILL_CLASS[group] ?? 'pill-neutral', className)}
    >
      {group ? properNoun(group) : 'Unassigned'}
    </span>
  )
}
