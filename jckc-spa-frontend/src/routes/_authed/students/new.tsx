import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { CheckIcon, UserRoundPlusIcon, UsersRoundIcon } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useGuardian, useGuardians } from '#/api/guardians'
import { useCreateStudent } from '#/api/students'
import { FormSection } from '#/components/FormSection'
import { PageHeader } from '#/components/PageHeader'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { FieldGroup } from '#/components/ui/field'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
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
    <div className="flex flex-col gap-8">
      <PageHeader kicker="New enrollment" title="Student Registration" />

      <Form {...form}>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="flex flex-col gap-6"
          noValidate
        >
          <SurfaceCard
            className="rise-in rounded-3xl p-6 sm:p-8"
            style={{ animationDelay: '80ms' }}
          >
            <FormSection
              kicker="Student Info"
              title="Student Application"
              description="Submit a new student application"
            >
              <StudentFields control={form.control} />
            </FormSection>
          </SurfaceCard>

          <SurfaceCard
            className="rise-in rounded-3xl p-6 sm:p-8"
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
                    <FieldGroup className="grid gap-5 sm:grid-cols-2">
                      <GuardianPersonalFields control={form.control} />
                    </FieldGroup>
                  </TabsContent>

                  <TabsContent
                    value="existing"
                    className="mt-4 flex flex-col gap-4"
                  >
                    <Command
                      shouldFilter={false}
                      className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
                    >
                      <CommandInput
                        value={pickerQuery}
                        onValueChange={setPickerQuery}
                        placeholder="Search parents / guardians by name..."
                        aria-label="Search parents / guardians"
                      />
                      <CommandList className="max-h-64">
                        {guardiansQuery.isPending ? (
                          <CommandGroup>
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                          </CommandGroup>
                        ) : filteredGuardians.length === 0 ? (
                          <CommandEmpty>
                            {pickerQuery.trim()
                              ? `No matches for "${pickerQuery.trim()}"`
                              : 'No parents / guardians available.'}
                          </CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {filteredGuardians.map((option) => {
                              const selected = option.id === selectedGuardianId
                              return (
                                <CommandItem
                                  key={option.id}
                                  value={`${option.guardianFirstName} ${option.guardianLastName}`}
                                  onSelect={() =>
                                    form.setValue('guardianId', option.id, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    })
                                  }
                                  className="justify-between"
                                >
                                  <span>
                                    {option.guardianFirstName}{' '}
                                    {option.guardianLastName}
                                  </span>
                                  {selected ? (
                                    <CheckIcon
                                      data-icon="inline-end"
                                      className="text-[var(--lagoon-deep)]"
                                      aria-hidden
                                    />
                                  ) : null}
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                    {guardianIdError ? (
                      <p className="text-sm text-destructive">
                        {guardianIdError}
                      </p>
                    ) : null}

                    {selectedGuardianId ? (
                      selectedGuardian ? (
                        <FieldGroup className="gap-0 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-5 py-1">
                          <GuardianInfoList guardian={selectedGuardian} />
                        </FieldGroup>
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
          </SurfaceCard>

          <SurfaceCard
            className="rise-in rounded-3xl p-6 sm:p-8"
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
          </SurfaceCard>

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
