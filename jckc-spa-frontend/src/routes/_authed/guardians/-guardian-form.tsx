// Shared pieces for the guardian pages. The `-` filename prefix keeps this
// file out of TanStack Router's route generation.
import { z } from 'zod'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { US_STATE_CODES } from '#/lib/age'
import { cn } from '#/lib/utils'
import type { Control } from 'react-hook-form'
import type { GuardianInput } from '#/api/types'

/**
 * Zod schema for the 7 guardian personal fields (guardians.md §4.2): legacy
 * 57-code state select, ZIP as a 5-digit STRING (fixes the number-input
 * leading-zero bug) and NNN-NNN-NNNN phone format.
 */
export const guardianPersonalSchema = z.object({
  guardianFirstName: z.string().trim().min(1, 'First name is required'),
  guardianLastName: z.string().trim().min(1, 'Last name is required'),
  guardianStreetAddress: z.string().trim().min(1, 'Street address is required'),
  guardianCity: z.string().trim().min(1, 'City is required'),
  guardianState: z.string().min(1, 'State is required'),
  guardianZIP: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Enter a 5-digit ZIP code'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\d{3}-\d{3}-\d{4}$/, 'Use the format 423-926-2221'),
})

/** `street, city, STATE ZIP` — the legacy display convention. */
export function formatGuardianAddress(guardian: {
  guardianStreetAddress: string
  guardianCity: string
  guardianState: string
  guardianZIP: string
}): string {
  return `${guardian.guardianStreetAddress}, ${guardian.guardianCity}, ${guardian.guardianState} ${guardian.guardianZIP}`
}

/**
 * The 7 personal-info form fields, laid out for a two-column grid (the
 * street address spans both columns). Works with any form whose values
 * extend the flat `GuardianInput` shape.
 */
export function GuardianPersonalFields<TValues extends GuardianInput>({
  control,
}: {
  control: Control<TValues>
}) {
  // Only the 7 shared guardian keys are touched below, so narrowing the
  // control to the base shape is safe for any extending form.
  const c = control as unknown as Control<GuardianInput>

  return (
    <>
      <FormField
        control={c}
        name="guardianFirstName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Parent / Guardian First Name</FormLabel>
            <FormControl>
              <Input autoComplete="given-name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={c}
        name="guardianLastName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Parent / Guardian Last Name</FormLabel>
            <FormControl>
              <Input autoComplete="family-name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={c}
        name="guardianStreetAddress"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Parent / Guardian Address</FormLabel>
            <FormControl>
              <Input autoComplete="street-address" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={c}
        name="guardianCity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>City</FormLabel>
            <FormControl>
              <Input autoComplete="address-level2" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={c}
        name="guardianState"
        render={({ field }) => (
          <FormItem>
            <FormLabel>State / Province</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                {US_STATE_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={c}
        name="guardianZIP"
        render={({ field }) => (
          <FormItem>
            <FormLabel>ZIP / Postal Code</FormLabel>
            <FormControl>
              <Input
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={c}
        name="phoneNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <FormControl>
              <Input
                type="tel"
                autoComplete="tel"
                placeholder="423-926-2221"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

/**
 * Read-only Name / Address / Phone definition list — the details page's info
 * card and the add page's "selected guardian" panel.
 */
export function GuardianInfoList({
  guardian,
  className,
}: {
  guardian: GuardianInput
  className?: string
}) {
  const rows: Array<[string, string]> = [
    [
      'Parent / Guardian Name',
      `${guardian.guardianFirstName} ${guardian.guardianLastName}`,
    ],
    ['Address', formatGuardianAddress(guardian)],
    ['Phone Number', guardian.phoneNumber],
  ]

  return (
    <dl className={cn('divide-y divide-[var(--line)]', className)}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 py-3.5 sm:grid-cols-[220px_1fr] sm:gap-4"
        >
          <dt className="text-sm font-semibold text-[var(--sea-ink-soft)]">
            {label}
          </dt>
          <dd className="text-sm font-medium text-[var(--sea-ink)]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
