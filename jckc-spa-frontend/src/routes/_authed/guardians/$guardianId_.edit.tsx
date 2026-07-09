import { useMemo } from 'react'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { TriangleAlertIcon, UsersRoundIcon } from 'lucide-react'
import { z } from 'zod'
import { useGuardian, useUpdateGuardian } from '#/api/guardians'
import { EmptyState } from '#/components/EmptyState'
import { FormSection } from '#/components/FormSection'
import { PageHeader } from '#/components/PageHeader'
import { SurfaceCard } from '#/components/SurfaceCard'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Field, FieldGroup } from '#/components/ui/field'
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
import {
  GuardianPersonalFields,
  guardianPersonalSchema,
} from '#/routes/_authed/guardians/-guardian-form'
import type { GuardianLinkDto } from '#/api/types'

interface GuardianEditSearch {
  /** Carried through from the details page so Cancel/Save return there intact. */
  from?: string
}

export const Route = createFileRoute('/_authed/guardians/$guardianId_/edit')({
  validateSearch: (search: Record<string, unknown>): GuardianEditSearch => ({
    from:
      typeof search.from === 'string' && search.from !== ''
        ? search.from
        : undefined,
  }),
  beforeLoad: ({ context }) => {
    // Guardian management is admin-only (fixes legacy quirk Q1).
    if (context.session.user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: EditGuardianPage,
})

const editGuardianSchema = guardianPersonalSchema.extend({
  links: z.array(
    z.object({
      studentId: z.string(),
      relationshipToStudent: z
        .string()
        .trim()
        .min(1, 'Relationship is required'),
      authorizedToPickUp: z.boolean(),
    }),
  ),
})

type EditGuardianValues = z.infer<typeof editGuardianSchema>

type ResolvedLink = GuardianLinkDto & {
  student: NonNullable<GuardianLinkDto['student']>
}

function EditGuardianPage() {
  const { guardianId } = Route.useParams()
  const { from } = Route.useSearch()
  const navigate = Route.useNavigate()
  const guardianQuery = useGuardian(guardianId)
  const updateGuardian = useUpdateGuardian()
  const guardian = guardianQuery.data

  // Only links whose student still exists are editable; dangling legacy
  // links are shown read-only and preserved untouched by the server.
  const resolvedLinks = useMemo(
    () =>
      (guardian?.students ?? []).filter(
        (link): link is ResolvedLink => link.student !== null,
      ),
    [guardian],
  )
  const danglingLinks = useMemo(
    () => (guardian?.students ?? []).filter((link) => link.student === null),
    [guardian],
  )

  const form = useForm<EditGuardianValues>({
    resolver: zodResolver(editGuardianSchema),
    defaultValues: {
      guardianFirstName: '',
      guardianLastName: '',
      guardianStreetAddress: '',
      guardianCity: '',
      guardianState: '',
      guardianZIP: '',
      phoneNumber: '',
      links: [],
    },
    // Re-sync the form whenever fresh guardian data arrives.
    values: guardian
      ? {
          guardianFirstName: guardian.guardianFirstName,
          guardianLastName: guardian.guardianLastName,
          guardianStreetAddress: guardian.guardianStreetAddress,
          guardianCity: guardian.guardianCity,
          guardianState: guardian.guardianState,
          guardianZIP: guardian.guardianZIP,
          phoneNumber: guardian.phoneNumber,
          links: resolvedLinks.map((link) => ({
            studentId: link.studentId,
            relationshipToStudent: link.relationshipToStudent || '',
            authorizedToPickUp: Boolean(link.authorizedToPickUp),
          })),
        }
      : undefined,
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateGuardian.mutateAsync({ id: guardianId, ...values })
    } catch {
      // error toast already handled by the mutation hook
      return
    }
    await navigate({
      to: '/guardians/$guardianId',
      params: { guardianId },
      search: { from },
    })
  })

  if (!guardian) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          kicker="Parents & Guardians"
          title="Edit Parent / Guardian Details"
        />
        {guardianQuery.isError ? (
          <SurfaceCard className="rise-in rounded-3xl">
            <EmptyState
              icon={UsersRoundIcon}
              title="Parent / guardian not found"
              message="This parent / guardian may have been deleted, or the link you followed is out of date."
              action={
                <Button asChild>
                  <Link to="/students">Back to Students</Link>
                </Button>
              }
            />
          </SurfaceCard>
        ) : (
          <SurfaceCard className="rounded-3xl p-6 sm:p-8">
            <Skeleton className="h-6 w-56" />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full sm:col-span-2" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </SurfaceCard>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        kicker="Parents & Guardians"
        title="Edit Parent / Guardian Details"
      />

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
            <FormSection
              kicker="Contact"
              title="Edit Parent / Guardian Info"
              description="Update a parent's / guardian's information."
            >
              <GuardianPersonalFields control={form.control} />
            </FormSection>
          </SurfaceCard>

          <SurfaceCard
            className="rise-in rounded-3xl p-6 sm:p-8"
            style={{ animationDelay: '140ms' }}
          >
            <FormSection
              columns={1}
              kicker="Little ones"
              title="Assigned Students"
              description="Update this parent / guardian's relationship and pickup permission for each assigned student."
            >
              {resolvedLinks.length === 0 ? (
                <EmptyState
                  icon={UsersRoundIcon}
                  message="No assigned students available to edit."
                  className="rounded-2xl border border-dashed border-[var(--line)] px-6 py-10"
                />
              ) : (
                resolvedLinks.map((link, index) => {
                  const studentName = `${link.student.studentFirstName} ${link.student.studentLastName}`
                  return (
                    <FieldGroup
                      key={link.studentId}
                      className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
                    >
                      <FieldGroup className="grid gap-5 sm:grid-cols-2">
                        <div className="grid content-start gap-2">
                          <span className="text-sm font-medium text-[var(--sea-ink)]">
                            Student
                          </span>
                          <span className="flex h-9 items-center rounded-md border border-[var(--line)] bg-[var(--chip-bg)] px-3 text-sm font-semibold text-[var(--sea-ink)]">
                            {studentName}
                          </span>
                        </div>
                        <FormField
                          control={form.control}
                          name={`links.${index}.relationshipToStudent`}
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
                      </FieldGroup>
                      <FormField
                        control={form.control}
                        name={`links.${index}.authorizedToPickUp`}
                        render={({ field }) => (
                          <FormItem className="mt-4 flex flex-row items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked === true)
                                }
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Allow pickup for {studentName}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </FieldGroup>
                  )
                })
              )}
            </FormSection>

            {danglingLinks.length > 0 ? (
              <UnresolvedLinksPanel links={danglingLinks} />
            ) : null}
          </SurfaceCard>

          <div
            className="rise-in flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
            style={{ animationDelay: '200ms' }}
          >
            <Button asChild type="button" variant="outline">
              <Link
                to="/guardians/$guardianId"
                params={{ guardianId }}
                search={{ from }}
              >
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={updateGuardian.isPending}>
              {updateGuardian.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

/**
 * Legacy-parity amber panel: links whose student record no longer exists are
 * listed read-only and preserved unchanged on save.
 */
function UnresolvedLinksPanel({ links }: { links: GuardianLinkDto[] }) {
  return (
    <Alert
      className="mt-8 rounded-2xl"
      style={{
        background: 'color-mix(in oklab, var(--age-toddler) 9%, transparent)',
        borderColor: 'color-mix(in oklab, var(--age-toddler) 38%, transparent)',
      }}
    >
      <TriangleAlertIcon
        style={{ color: 'var(--age-toddler-ink)' }}
        aria-hidden
      />
      <AlertTitle className="display-title text-base font-semibold text-[var(--sea-ink)]">
        Unresolved Student Links
      </AlertTitle>
      <AlertDescription>
        <p>
          These links could not be matched to an active student record. They are
          shown for reference and will be preserved unchanged when you save.
        </p>
        <FieldGroup className="mt-3 gap-2">
          {links.map((link) => (
            <Field
              key={link.studentId}
              orientation="responsive"
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm"
            >
              <Badge
                variant="outline"
                className="font-mono text-xs text-[var(--sea-ink-soft)]"
              >
                {link.studentId}
              </Badge>
              <span className="text-[var(--sea-ink)]">
                Relationship:{' '}
                <span className="font-medium">
                  {link.relationshipToStudent || 'Not set'}
                </span>
              </span>
              <span className="text-[var(--sea-ink)]">
                Authorized for pickup:{' '}
                <span className="font-medium">
                  {link.authorizedToPickUp ? 'Yes' : 'No'}
                </span>
              </span>
            </Field>
          ))}
        </FieldGroup>
      </AlertDescription>
    </Alert>
  )
}
