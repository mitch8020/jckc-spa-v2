import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormSection } from '#/components/FormSection'
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
import type { ReactNode } from 'react'
import type { ClassroomInput } from '#/api/types'

const classroomSchema = z.object({
  classroomName: z.string().trim().min(1, 'Classroom name is required'),
  ageGroup: z.enum(['infant', 'toddler', 'preschool'], {
    message: 'Choose an age group',
  }),
  teacherName: z.string().trim().min(1, 'Teacher name is required'),
})

type ClassroomFormValues = z.infer<typeof classroomSchema>

// Consistent labels everywhere — fixes the legacy add-new form's stray
// 'Infant/Toddler' label for the infant option (classrooms.md quirk 11).
const AGE_GROUP_OPTIONS = [
  { value: 'infant', label: 'Infant' },
  { value: 'toddler', label: 'Toddler' },
  { value: 'preschool', label: 'Preschool' },
] as const

/**
 * Shared create/edit classroom form card. Field names match the API DTO
 * exactly: classroomName, ageGroup, teacherName (all required).
 */
export function ClassroomForm({
  heading,
  description,
  defaultValues,
  submitLabel,
  pending,
  cancel,
  onSubmit,
}: {
  heading: string
  description: string
  defaultValues?: ClassroomInput
  submitLabel: string
  pending: boolean
  /** Cancel button/link rendered beside the submit button. */
  cancel: ReactNode
  onSubmit: (values: ClassroomInput) => void
}) {
  const form = useForm<ClassroomFormValues>({
    resolver: zodResolver(classroomSchema),
    defaultValues: defaultValues ?? { classroomName: '', teacherName: '' },
  })

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values)
  })

  return (
    <div
      className="island-shell rise-in max-w-xl rounded-3xl p-6 sm:p-8"
      style={{ animationDelay: '80ms' }}
    >
      <Form {...form}>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="grid gap-6"
          noValidate
        >
          <FormSection title={heading} description={description} columns={1}>
            <FormField
              control={form.control}
              name="classroomName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Classroom Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Seahorse Room" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ageGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age Group</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose an age group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AGE_GROUP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
              name="teacherName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teacher Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ms. Maren" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-5 sm:flex-row sm:justify-end">
            {cancel}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
