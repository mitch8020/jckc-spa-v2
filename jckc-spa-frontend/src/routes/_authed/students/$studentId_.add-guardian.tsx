import { useMemo, useState } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  BabyIcon,
  CheckIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { z } from 'zod'
import {
  useAddGuardianToStudent,
  useGuardian,
  useGuardians,
  useStudentForGuardian,
} from '#/api/guardians'
import { EmptyState } from '#/components/EmptyState'
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
import type { AddGuardianToStudentBody } from '#/api/types'

export const Route = createFileRoute(
  '/_authed/students/$studentId_/add-guardian',
)({
  beforeLoad: ({ context }) => {
    // Guardian management is admin-only (fixes legacy quirk Q1).
    if (context.session.user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AddGuardianPage,
})

const addGuardianSchema = z
  .object({
    mode: z.enum(['new', 'existing']),
    guardianId: z.string(),
    // The 7 personal fields are only validated in "new" mode (superRefine).
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

type AddGuardianValues = z.infer<typeof addGuardianSchema>

function AddGuardianPage() {
  const { studentId } = Route.useParams()
  const navigate = Route.useNavigate()
  const studentQuery = useStudentForGuardian(studentId)
  const guardiansQuery = useGuardians()
  const addGuardian = useAddGuardianToStudent()
  const [pickerQuery, setPickerQuery] = useState('')

  const form = useForm<AddGuardianValues>({
    resolver: zodResolver(addGuardianSchema),
    defaultValues: {
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
      // Default checked, and — unlike legacy — actually honored on submit.
      authorizedToPickUp: true,
    },
  })

  const mode = form.watch('mode')
  const selectedGuardianId = form.watch('guardianId')
  const selectedGuardianQuery = useGuardian(
    mode === 'existing' ? selectedGuardianId : '',
  )

  const student = studentQuery.data
  const studentName = student
    ? `${student.studentFirstName} ${student.studentLastName}`
    : 'this student'

  // Guardians not yet linked to this student are pickable.
  const availableGuardians = useMemo(
    () =>
      (guardiansQuery.data ?? []).filter(
        (option) => !option.studentIds.includes(studentId),
      ),
    [guardiansQuery.data, studentId],
  )
  const filteredGuardians = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase()
    if (!query) return availableGuardians
    return availableGuardians.filter((option) =>
      `${option.guardianFirstName} ${option.guardianLastName}`
        .toLowerCase()
        .includes(query),
    )
  }, [availableGuardians, pickerQuery])

  const handleModeChange = (value: string) => {
    form.setValue('mode', value === 'existing' ? 'existing' : 'new')
    form.clearErrors()
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const body: AddGuardianToStudentBody & { studentId: string } =
      values.mode === 'existing'
        ? {
            studentId,
            guardianId: values.guardianId,
            relationshipToStudent: values.relationshipToStudent,
            authorizedToPickUp: values.authorizedToPickUp,
          }
        : {
            studentId,
            guardian: {
              guardianFirstName: values.guardianFirstName.trim(),
              guardianLastName: values.guardianLastName.trim(),
              guardianStreetAddress: values.guardianStreetAddress.trim(),
              guardianCity: values.guardianCity.trim(),
              guardianState: values.guardianState,
              guardianZIP: values.guardianZIP.trim(),
              phoneNumber: values.phoneNumber.trim(),
            },
            relationshipToStudent: values.relationshipToStudent,
            authorizedToPickUp: values.authorizedToPickUp,
          }
    try {
      await addGuardian.mutateAsync(body)
    } catch {
      // error toast (incl. the 409 "Guardian already linked" case) is
      // handled by the mutation hook
      return
    }
    await navigate({ to: '/students/$studentId', params: { studentId } })
  })

  if (studentQuery.isError) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          kicker="Parents & Guardians"
          title="Add Parent / Guardian"
        />
        <SurfaceCard className="rise-in rounded-3xl">
          <EmptyState
            icon={BabyIcon}
            title="Student not found"
            message="This student may have been deleted, or the link you followed is out of date."
            action={
              <Button asChild>
                <Link to="/students">Back to Students</Link>
              </Button>
            }
          />
        </SurfaceCard>
      </div>
    )
  }

  const guardianIdError = form.formState.errors.guardianId?.message
  const selectedGuardian = selectedGuardianQuery.data

  return (
    <div className="flex flex-col gap-8">
      <PageHeader kicker="Parents & Guardians" title="Add Parent / Guardian" />

      <Form {...form}>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="flex flex-col gap-8"
          noValidate
        >
          <SurfaceCard
            className="rise-in rounded-3xl p-6 sm:p-8"
            style={{ animationDelay: '60ms' }}
          >
            <div>
              <p className="island-kicker">Parent / Guardian Info</p>
              <h2 className="display-title mt-1 text-xl font-semibold text-[var(--sea-ink)]">
                Add a parent / guardian for {studentName}
              </h2>
              <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
                Create a new parent / guardian, or link one who is already in
                the system.
              </p>
            </div>

            <Tabs
              value={mode}
              onValueChange={handleModeChange}
              className="mt-6"
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
                    placeholder="Search parents / guardians by name…"
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
                        {availableGuardians.length === 0
                          ? 'No other parents / guardians available — create a new one instead.'
                          : `No matches for "${pickerQuery.trim()}"`}
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
                  <p className="text-sm text-destructive">{guardianIdError}</p>
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
          </SurfaceCard>

          <SurfaceCard
            className="rise-in rounded-3xl p-6 sm:p-8"
            style={{ animationDelay: '140ms' }}
          >
            <FormSection
              columns={1}
              kicker="Relationship"
              title="Additional Info"
              description={`Describe this parent / guardian's relationship to ${studentName}.`}
            >
              <FormField
                control={form.control}
                name="relationshipToStudent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to Student</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mother, Father, Grandparent…"
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
                      Authorized to Pick Up {studentName}
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
              <Link to="/students/$studentId" params={{ studentId }}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={addGuardian.isPending}>
              {addGuardian.isPending
                ? 'Saving…'
                : mode === 'existing'
                  ? 'Link Guardian'
                  : 'Add Guardian'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
