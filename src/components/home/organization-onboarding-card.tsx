import { useForm } from '@tanstack/react-form'
import { Building2, Loader2, Users } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod/v4'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { FieldError } from '#/components/ui/field-error'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'

const organizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Organization name is required.')
    .max(120, 'Organization name must be 120 characters or fewer.'),
  slug: z
    .string()
    .trim()
    .min(1, 'Organization slug is required.')
    .regex(
      /^[a-z0-9-]+$/,
      'Organization slug can only contain lowercase letters, numbers, and hyphens.',
    ),
})

type OrganizationFormValues = z.input<typeof organizationFormSchema>

type OrganizationOnboardingCardProps = {
  onCreated?: () => Promise<unknown>
}

function getSchemaError(
  schema: z.ZodTypeAny,
  value: unknown,
): string | undefined {
  const result = schema.safeParse(value)
  return result.success ? undefined : result.error.issues[0]?.message
}

function slugifyOrganizationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function OrganizationOnboardingCard({
  onCreated,
}: OrganizationOnboardingCardProps) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const defaultValues: OrganizationFormValues = {
    name: '',
    slug: '',
  }
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      try {
        const organization = await authClient.organization.create({
          name: value.name.trim(),
          slug: slugifyOrganizationName(value.slug),
          fetchOptions: { throw: true },
        })

        await authClient.organization.setActive({
          organizationId: organization.id,
        })

        await onCreated?.()
        setSlugManuallyEdited(false)
        form.reset()
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to create organization.'
        setSubmitError(message)
      }
    },
  })

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="text-muted-foreground size-5" aria-hidden />
          <CardTitle>Create or join an organization</CardTitle>
        </div>
        <CardDescription>
          You need at least one organization before you can use the workspace.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) =>
                getSchemaError(organizationFormSchema.shape.name, value),
              onSubmit: ({ value }) =>
                getSchemaError(organizationFormSchema.shape.name, value),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Organization name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  autoComplete="organization"
                  placeholder="DriveCellar Team"
                  aria-invalid={field.state.meta.errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    const nextName = event.target.value
                    field.handleChange(nextName)

                    if (!slugManuallyEdited) {
                      form.setFieldValue(
                        'slug',
                        slugifyOrganizationName(nextName),
                      )
                    }
                  }}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="slug"
            validators={{
              onChange: ({ value }) =>
                getSchemaError(organizationFormSchema.shape.slug, value),
              onSubmit: ({ value }) =>
                getSchemaError(organizationFormSchema.shape.slug, value),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Organization slug</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="drivecellar-team"
                  aria-invalid={field.state.meta.errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    setSlugManuallyEdited(true)
                    field.handleChange(
                      slugifyOrganizationName(event.target.value),
                    )
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  Lowercase letters, numbers, and hyphens only.
                </p>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          {submitError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not create organization</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <form.Subscribe
            selector={(state) => ({
              canSubmit: organizationFormSchema.safeParse(state.values).success,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                className="w-full"
                disabled={!canSubmit || isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating organization…
                  </>
                ) : (
                  'Create organization'
                )}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            If someone invited you to an existing organization, accept the
            Better Auth invitation from the invite email or your account
            invitations screen.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
