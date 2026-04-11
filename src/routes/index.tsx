import { AuthView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, FolderOpen, Loader2, Users } from 'lucide-react'
import { useState } from 'react'
import type { ComponentProps } from 'react'

import { AppShell } from '#/components/app-shell'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({ component: HomePage })

function slugifyOrganizationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function HomePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const {
    data: organizations,
    isPending: orgsPending,
    refetch: refetchOrganizations,
  } = authClient.useListOrganizations()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const user = session?.user
  const hasOrgs = (organizations?.length ?? 0) > 0

  const handleCreateOrganization: NonNullable<
    ComponentProps<'form'>['onSubmit']
  > = async (event) => {
    event.preventDefault()

    const trimmedName = name.trim()
    const normalizedSlug = slugifyOrganizationName(slug)

    if (!trimmedName) {
      setError('Organization name is required.')
      return
    }

    if (!normalizedSlug) {
      setError('Organization slug is required.')
      return
    }

    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      setError(
        'Organization slug can only contain lowercase letters, numbers, and hyphens.',
      )
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const organization = await authClient.organization.create({
        name: trimmedName,
        slug: normalizedSlug,
        fetchOptions: { throw: true },
      })

      await authClient.organization.setActive({
        organizationId: organization.id,
      })

      await refetchOrganizations()
      setName('')
      setSlug('')
      setSlugTouched(false)
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : 'Failed to create organization.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell footer={false}>
      <main className="flex min-h-0 flex-1 flex-col">
        {sessionPending ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
            Loading…
          </div>
        ) : !user ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-[min(100%,24rem)]">
              <AuthView pathname="sign-in" />
            </div>
          </div>
        ) : orgsPending ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
            Loading…
          </div>
        ) : !hasOrgs ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2
                    className="text-muted-foreground size-5"
                    aria-hidden
                  />
                  <CardTitle>Create or join an organization</CardTitle>
                </div>
                <CardDescription>
                  You need at least one organization before you can use the
                  workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="space-y-4" onSubmit={handleCreateOrganization}>
                  <div className="space-y-1.5">
                    <label
                      className="text-sm font-medium"
                      htmlFor="organization-name"
                    >
                      Organization name
                    </label>
                    <input
                      id="organization-name"
                      className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/30 flex h-10 w-full rounded-2xl border px-3 text-sm outline-none focus-visible:ring-3"
                      autoComplete="organization"
                      disabled={isSubmitting}
                      placeholder="DriveCellar Team"
                      value={name}
                      onChange={(event) => {
                        const nextName = event.target.value
                        setName(nextName)

                        if (!slugTouched) {
                          setSlug(slugifyOrganizationName(nextName))
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="text-sm font-medium"
                      htmlFor="organization-slug"
                    >
                      Organization slug
                    </label>
                    <input
                      id="organization-slug"
                      className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/30 flex h-10 w-full rounded-2xl border px-3 text-sm outline-none focus-visible:ring-3"
                      autoCapitalize="none"
                      autoCorrect="off"
                      disabled={isSubmitting}
                      placeholder="drivecellar-team"
                      value={slug}
                      onChange={(event) => {
                        setSlugTouched(true)
                        setSlug(slugifyOrganizationName(event.target.value))
                      }}
                    />
                    <p className="text-muted-foreground text-xs">
                      Lowercase letters, numbers, and hyphens only.
                    </p>
                  </div>

                  {error ? (
                    <Alert variant="destructive">
                      <AlertTitle>Could not create organization</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Button
                    className="w-full"
                    disabled={isSubmitting}
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
                </form>

                <div className="text-muted-foreground flex items-start gap-2 text-sm">
                  <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>
                    If someone invited you to an existing organization, accept
                    the Better Auth invitation from the invite email or your
                    account invitations screen.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="border-border/80 flex h-11 shrink-0 items-center border-b px-4 md:px-6">
              <span className="text-sm font-medium">Files</span>
            </div>
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
              <FolderOpen
                className="text-muted-foreground/40 size-12"
                aria-hidden
              />
              <p className="text-foreground font-medium">Workspace</p>
              <p className="max-w-sm">
                Storage connections and file browsing will appear here.
              </p>
            </div>
          </>
        )}
      </main>
    </AppShell>
  )
}
