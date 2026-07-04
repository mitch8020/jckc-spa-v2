import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import {
  Form,
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
import { DEFAULT_STATE, US_STATE_CODES } from '#/lib/age'
import type { ReactNode } from 'react'
import type { StudentInput } from '#/api/types'

// Field names + validation rules per API-CONTRACT.md POST /api/students:
// all 7 fields required; state in the 57-code list; DOB a valid YYYY-MM-DD
// not in the future; ZIP exactly 5 digits (kept as a string).
const studentSchema = z.object({
  studentFirstName: z.string().trim().min(1, 'First name is required'),
  studentLastName: z.string().trim().min(1, 'Last name is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date of birth')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date')
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      'Date of birth cannot be in the future',
    ),
  studentStreetAddress: z.string().trim().min(1, 'Street address is required'),
  studentCity: z.string().trim().min(1, 'City is required'),
  studentState: z.enum(US_STATE_CODES, { message: 'Choose a state' }),
  studentZIP: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'ZIP code must be 5 digits'),
})

export type StudentFormValues = z.infer<typeof studentSchema>

const EMPTY_VALUES: StudentFormValues = {
  studentFirstName: '',
  studentLastName: '',
  dateOfBirth: '',
  studentStreetAddress: '',
  studentCity: '',
  studentState: DEFAULT_STATE,
  studentZIP: '',
}

/**
 * The shared 7-field student form (legacy §6.1/§6.6): create when
 * `initialValues` is absent, edit (pre-filled) when present. The caller owns
 * submission + navigation; `cancel` is a slot for the role-appropriate
 * Cancel link.
 */
export function StudentForm({
  initialValues,
  submitting,
  onSubmit,
  cancel,
}: {
  initialValues?: StudentInput
  submitting: boolean
  onSubmit: (values: StudentFormValues) => void | Promise<void>
  cancel: ReactNode
}) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: initialValues
      ? { ...EMPTY_VALUES, ...(initialValues as Partial<StudentFormValues>) }
      : EMPTY_VALUES,
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="grid gap-5"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="studentFirstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Student First Name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="studentLastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Student Last Name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date Of Birth</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="studentStreetAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student&apos;s Main Residence</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder="Street address"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="studentCity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="studentState"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State / Province</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="State" />
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
            control={form.control}
            name="studentZIP"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP / Postal Code</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    maxLength={5}
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {cancel}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
