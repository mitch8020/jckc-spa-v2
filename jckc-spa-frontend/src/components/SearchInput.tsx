import { useEffect, useRef, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { cn } from '#/lib/utils'

/**
 * Debounced (300ms) search input with a clear button. `value` is the
 * committed external value (usually a route search param); `onChange` fires
 * after the debounce (or immediately on clear).
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search by name...',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value)
  const lastEmitted = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from outside (e.g. a filter change reset the search param), but
  // never clobber in-flight typing with our own echoed-back value.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const emit = (next: string) => {
    lastEmitted.current = next
    onChange(next)
  }

  const handleChange = (next: string) => {
    setText(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => emit(next), 300)
  }

  const handleClear = () => {
    if (timer.current) clearTimeout(timer.current)
    setText('')
    emit('')
  }

  return (
    <InputGroup className={className}>
      <InputGroupInput
        type="text"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        className={cn(text && 'pr-1')}
      />
      <InputGroupAddon align="inline-start">
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      {text ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            aria-label="Clear search"
            onClick={handleClear}
          >
            <XIcon aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
