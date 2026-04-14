import { Building2, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

import type { OrganizationSummary } from './organization-bootstrap'

type OrganizationChoiceCardProps = {
  organizations: OrganizationSummary[]
  errorMessage?: string | null
  helperMessage?: string | null
  isSubmitting?: boolean
  pendingOrganizationId?: string | null
  onSelect: (organizationId: string) => void | Promise<unknown>
}

export function OrganizationChoiceCard({
  organizations,
  errorMessage,
  helperMessage,
  isSubmitting = false,
  pendingOrganizationId = null,
  onSelect,
}: OrganizationChoiceCardProps) {
  return (
    <Card className="border-border bg-card w-full max-w-4xl rounded-[2rem] border p-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary rounded-[1rem] p-2">
            <Building2 className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-muted-foreground text-[0.73rem] font-bold tracking-[0.16em] uppercase">
              Team Selection
            </p>
            <CardTitle className="text-foreground mt-1 text-3xl leading-none">
              Choose a team to enter
            </CardTitle>
          </div>
        </div>
        <CardDescription className="text-muted-foreground pt-2 text-sm leading-6">
          {helperMessage ??
            'We could not finish opening a team automatically. Pick one below and we’ll take you in.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Could not enter team</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <div
              key={organization.id}
              className="border-border bg-muted/30 flex flex-col gap-4 rounded-[1.5rem] border p-5"
            >
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary rounded-xl p-2">
                  <Building2 className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-foreground truncate text-base font-semibold">
                    {organization.name}
                  </p>
                  {organization.slug ? (
                    <p className="text-muted-foreground truncate text-sm">
                      {organization.slug}
                    </p>
                  ) : null}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={isSubmitting}
                onClick={() => void onSelect(organization.id)}
                type="button"
              >
                {isSubmitting && pendingOrganizationId === organization.id ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Entering team...
                  </>
                ) : isSubmitting ? (
                  'Enter team'
                ) : (
                  'Enter team'
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
