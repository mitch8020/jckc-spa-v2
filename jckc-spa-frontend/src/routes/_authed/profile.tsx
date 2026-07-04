import { createFileRoute } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlertIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useMe, useUpdateMe } from '#/api/users'
import { EmptyState } from '#/components/EmptyState'
import { PageHeader } from '#/components/PageHeader'
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
import { Skeleton } from '#/components/ui/skeleton'
import { properNoun } from '#/lib/age'
import { useSessionUser } from '#/lib/session'

export const Route = createFileRoute('/_authed/profile')({
  component: ProfilePage,
})

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date')
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      'Date of birth cannot be in the future',
    ),
  phoneNumber: z.string().trim().min(7, 'Phone number is required'),
})

type ProfileValues = z.infer<typeof profileSchema>

function ProfilePage() {
  const user = useSessionUser()
  const meQuery = useMe()
  const updateMe = useUpdateMe()
  const me = meQuery.data

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phoneNumber: '',
    },
    // Re-sync the form whenever fresh /users/me data arrives.
    values: me
      ? {
          firstName: me.firstName,
          lastName: me.lastName,
          dateOfBirth: me.dateOfBirth,
          phoneNumber: me.phoneNumber,
        }
      : undefined,
  })

  const onSubmit = form.handleSubmit((values) => {
    updateMe.mutate(values)
  })

  const roleTitle = `${properNoun(user.role || 'your')} Profile`

  return (
    <div className="space-y-8">
      <PageHeader kicker="Your account" title={roleTitle} />

      <div
        className="island-shell rise-in max-w-2xl rounded-3xl p-6 sm:p-8"
        style={{ animationDelay: '80ms' }}
      >
        {meQuery.isPending ? (
          <div className="grid gap-5">
            <Skeleton className="h-9 w-full" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ) : meQuery.isError ? (
          <EmptyState
            icon={CircleAlertIcon}
            title="Couldn't load your profile"
            message={meQuery.error.message}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => void meQuery.refetch()}
              >
                Try again
              </Button>
            }
          />
        ) : (
          <Form {...form}>
            <form
              onSubmit={(event) => void onSubmit(event)}
              className="grid gap-5"
              noValidate
            >
              {/* email comes from the auth account and is read-only */}
              <div className="grid gap-2">
                <p className="text-sm font-medium">Email</p>
                <p className="flex h-9 items-center rounded-md border border-[var(--line)] bg-[var(--chip-bg)] px-3 text-sm text-[var(--sea-ink-soft)]">
                  {me?.email ?? user.email}
                </p>
                <p className="text-xs text-[var(--sea-ink-soft)]">
                  Your email is managed by your sign-in account.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of birth</FormLabel>
                      <FormControl>
                        <Input type="date" autoComplete="bday" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          autoComplete="tel"
                          placeholder="423-555-0123"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={updateMe.isPending}>
                  {updateMe.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  )
}
