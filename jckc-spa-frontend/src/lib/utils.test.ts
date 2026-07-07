import { describe, expect, it } from 'vitest'
import { cn } from './utils'

function optionalHidden(enabled: boolean) {
  return enabled ? 'hidden' : false
}

describe('cn', () => {
  it('combines conditional classes and resolves Tailwind conflicts', () => {
    expect(cn('px-2', optionalHidden(false), ['text-sm', 'px-4'])).toBe(
      'text-sm px-4',
    )
  })
})
