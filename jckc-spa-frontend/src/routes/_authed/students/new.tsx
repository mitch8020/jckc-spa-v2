import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import {
  CheckIcon,
  SearchIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useGuardian, useGuardians } from '#/api/guardians'
import { useCreateStudent } from '#/api/students'
import { FormSection } from '#/components/FormSection'
import { PageHeader } from '#/components/PageHeader'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  GuardianInfoList,
  GuardianPersonalFields,
  guardianPersonalSchema,
} from '#/routes/_authed/guardians/-guardian-form'
import { DEFAULT_STATE } from '#/lib/age'
import { useSessionUser } from '#/lib/session'
import { cn } from '#/lib/utils'
import {
  EMPTY_STUDENT_VALUES,
  StudentFields,
  studentSchema,
} from './-student-form'
import type { CreateStudentBody } from '#/api/types'

export const Route = createFileRoute('/_authed/students/new')({
  // POST /api/students is admin + parent only - teachers are read-only.
  beforeLoad: ({ context }) => {
    if (context.session.user.role === 'teacher') {
      throw redirect({ to: '/students' })
    }
  },
  component: NewStudentPage,
})

const studentApplicationSchema = studentSchema
  .extend({
    mode: z.enum(['new', 'existing']),
    guardianId: z.string(),
    guardianFirstName: z.string(),
    guardianLastName: z.string(),
    guardianStreetAddress: z.string(),
    guardianCity: z.string(),
    guardianState: z.string(),
    guardianZIP: z.string(),
    phoneNumber: z.string(),
    relationshipToStudent: z
      .string()
      .trim()
      .min(1, 'Relationship to student is required'),
    authorizedToPickUp: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'existing') {
      if (!values.guardianId) {
        ctx.addIssue({
          code: 'custom',
          path: ['guardianId'],
          message: 'Select a parent / guardian from the list',
        })
      }
      return
    }

    const personal = guardianPersonalSchema.safeParse(values)
    if (!personal.success) {
      for (const issue of personal.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: [...issue.path] as Array<string | number>,
          message: issue.message,
        })
      }
    }
  })

type StudentApplicationFormValues = z.infer<typeof studentApplicationSchema>

const EMPTY_APPLICATION_VALUES: StudentApplicationFormValues = {
  ...EMPTY_STUDENT_VALUES,
  mode: 'new',
  guardianId: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianStreetAddress: '',
  guardianCity: '',
  guardianState: DEFAULT_STATE,
  guardianZIP: '',
  phoneNumber: '',
  relationshipToStudent: '',
  authorizedToPickUp: true,
}

function toCreateStudentBody(
  values: StudentApplicationFormValues,
): CreateStudentBody {
  const body: CreateStudentBody = {
    studentFirstName: values.studentFirstName,
    studentLastName: values.studentLastName,
    dateOfBirth: values.dateOfBirth,
    studentStreetAddress: values.studentStreetAddress,
    studentCity: values.studentCity,
    studentState: values.studentState,
    studentZIP: values.studentZIP,
    relationshipToStudent: values.relationshipToStudent,
    authorizedToPickUp: values.authorizedToPickUp,
  }

  if (values.mode === 'existing') {
    return { ...body, guardianId: values.guardianId }
  }

  return {
    ...body,
    guardian: {
      guardianFirstName: values.guardianFirstName,
      guardianLastName: values.guardianLastName,
      guardianStreetAddress: values.guardianStreetAddress,
      guardianCity: values.guardianCity,
      guardianState: values.guardianState,
      guardianZIP: values.guardianZIP,
      phoneNumber: values.phoneNumber,
    },
  }
}

function NewStudentPage() {
  const navigate = Route.useNavigate()
  const user = useSessionUser()
  const createStudent = useCreateStudent()
  const isAdmin = user.role === 'admin'
  const guardiansQuery = useGuardians(isAdmin)
  const [pickerQuery, setPickerQuery] = useState('')

  const form = useForm<StudentApplicationFormValues>({
    resolver: zodResolver(studentApplicationSchema),
    defaultValues: EMPTY_APPLICATION_VALUES,
  })

  const mode = form.watch('mode')
  const selectedGuardianId = form.watch('guardianId')
  const selectedGuardianQuery = useGuardian(
    isAdmin && mode === 'existing' ? selectedGuardianId : '',
  )

  const filteredGuardians = useMemo(() => {
    const options = guardiansQuery.data ?? []
    const query = pickerQuery.trim().toLowerCase()
    if (!query) return options
    return options.filter((option) =>
      `${option.guardianFirstName} ${option.guardianLastName}`
        .toLowerCase()
        .includes(query),
    )
  }, [guardiansQuery.data, pickerQuery])

  const handleModeChange = (value: string) => {
    form.setValue('mode', value === 'existing' && isAdmin ? 'existing' : 'new')
    form.clearErrors()
  }

  const onSubmit = form.handleSubmit(async (values) => {
    let created
    try {
      created = await createStudent.mutateAsync(toCreateStudentBody(values))
    } catch {
      // error toast already handled by the mutation hook
      return
    }
    if (isAdmin) {
      // Admin-created students are approved immediately - go to details.
      toast.success(
        `${created.studentFirstName} ${created.studentLastName} registered`,
      )
      await navigate({
        to: '/students/$studentId',
        params: { studentId: created.id },
      })
    } else {
      // Parent-created students become pending applications.
      toast.success('Student Application Submitted!')
      await navigate({ to: '/students' })
    }
  })

  const guardianIdError = form.formState.errors.guardianId?.message
  const selectedGuardian = selectedGuardianQuery.data

  return (
    <div className="space-y-8">
      <PageHeader kicker="New enrollment" title="Student Registration" />

      <Form {...form}>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-6"
          noValidate
        >
          <div
            className="island-shell rise-in rounded-3xl p-6 sm:p-8"
            style={{ animationDelay: '80ms' }}
          >
            <FormSection
              kicker="Student Info"
              title="Student Application"
              description="Submit a new student application"
            >
              <StudentFields control={form.control} />
            </FormSection>
          </div>

          <div
            className="island-shell rise-in rounded-3xl p-6 sm:p-8"
            style={{ animationDelay: '120ms' }}
          >
            <FormSection
              kicker="Parent / Guardian Info"
              title="Parent Information"
              description="Add or select the parent / guardian for this application."
            >
              {isAdmin ? (
                <Tabs
                  value={mode}
                  onValueChange={handleModeChange}
                  className="sm:col-span-2"
                >
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="new">
                      <UserRoundPlusIcon /> New Guardian
                    </TabsTrigger>
                    <TabsTrigger value="existing">
                      <UsersRoundIcon /> Existing Guardian
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="new" className="mt-4">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <GuardianPersonalFields control={form.control} />
                    </div>
                  </TabsContent>

                  <TabsContent value="existing" className="mt-4 space-y-4">
                    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                      <div className="relative border-b border-[var(--line)]">
                        <SearchIcon
                          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--sea-ink-soft)]"
                          aria-hidden
                        />
                        <input
                          type="text"
                          value={pickerQuery}
                          onChange={(event) =>
                            setPickerQuery(event.target.value)
                          }
                          placeholder="Search parents / guardians by name..."
                          aria-label="Search parents / guardians"
                          className="h-11 w-full bg-transparent pr-3 pl-9 text-sm text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)]"
                        />
                      </div>
                      <ul
                        role="listbox"
                        aria-label="Parents / guardians"
                        className="max-h-64 overflow-y-auto p-1.5"
                      >
                        {guardiansQuery.isPending ? (
                          <li className="space-y-1.5 px-1.5 py-1.5">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                          </li>
                        ) : filteredGuardians.length === 0 ? (
                          <li className="px-3 py-6 text-center text-sm text-[var(--sea-ink-soft)]">
                            {pickerQuery.trim()
                              ? `No matches for "${pickerQuery.trim()}"`
                              : 'No parents / guardians available.'}
                          </li>
                        ) : (
                          filteredGuardians.map((option) => {
                            const selected = option.id === selectedGuardianId
                            return (
                              <li key={option.id}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() =>
                                    form.setValue('guardianId', option.id, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    })
                                  }
                                  className={cn(
                                    'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
                                    selected &&
                                      'bg-[var(--link-bg-hover)] font-semibold',
                                  )}
                                >
                                  <span>
                                    {option.guardianFirstName}{' '}
                                    {option.guardianLastName}
                                  </span>
                                  {selected ? (
                                    <CheckIcon
                                      className="size-4 text-[var(--lagoon-deep)]"
                                      aria-hidden
                                    />
                                  ) : null}
                                </button>
                              </li>
                            )
                          })
                        )}
                      </ul>
                    </div>
                    {guardianIdError ? (
                      <p className="text-sm text-destructive">
                        {guardianIdError}
                      </p>
                    ) : null}

                    {selectedGuardianId ? (
                      selectedGuardian ? (
                        <div className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-5 py-1">
                          <GuardianInfoList guardian={selectedGuardian} />
                        </div>
                      ) : (
                        <Skeleton className="h-32 w-full rounded-2xl" />
                      )
                    ) : (
                      <p className="text-sm text-[var(--sea-ink-soft)]">
                        Select a parent / guardian to review their info.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <GuardianPersonalFields control={form.control} />
              )}
            </FormSection>
          </div>

          <div
            className="island-shell rise-in rounded-3xl p-6 sm:p-8"
            style={{ animationDelay: '160ms' }}
          >
            <FormSection
              columns={1}
              kicker="Relationship"
              title="Additional Info"
              description="Describe this parent / guardian's relationship to the student."
            >
              <FormField
                control={form.control}
                name="relationshipToStudent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to Student</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mother, Father, Grandparent..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="authorizedToPickUp"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Authorized to Pick Up
                    </FormLabel>
                  </FormItem>
                )}
              />
            </FormSection>
          </div>

          <div
            className="rise-in flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
            style={{ animationDelay: '200ms' }}
          >
            <Button asChild type="button" variant="outline">
              <Link to="/students">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createStudent.isPending}>
              {createStudent.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
