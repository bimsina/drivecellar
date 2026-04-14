import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

type OrganizationBootstrapRecoveryCardProps = {
  errorMessage: string
  isRetrying?: boolean
  onRetry: () => void | Promise<unknown>
}

export function OrganizationBootstrapRecoveryCard({
  errorMessage,
  isRetrying = false,
  onRetry,
}: OrganizationBootstrapRecoveryCardProps) {
  return (
    <Card className="border-border bg-card w-full max-w-xl rounded-[2rem] border p-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-[1rem] bg-amber-500/12 p-2 text-amber-600 dark:text-amber-300">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-muted-foreground text-[0.73rem] font-bold tracking-[0.16em] uppercase">
              Team Loading
            </p>
            <CardTitle className="text-foreground mt-1 text-3xl leading-none">
              We couldn&apos;t load your teams
            </CardTitle>
          </div>
        </div>
        <CardDescription className="text-muted-foreground pt-2 text-sm leading-6">
          Your account is signed in, but DriveCellar still needs a clean read of
          your session and team list before it can continue.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-muted/50 text-muted-foreground rounded-[1.25rem] border border-dashed p-4 text-sm leading-6">
          {errorMessage}
        </div>

        <Button
          className="w-full"
          disabled={isRetrying}
          onClick={() => void onRetry()}
        >
          {isRetrying ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Reloading your teams...
            </>
          ) : (
            <>
              <RefreshCcw className="size-4" />
              Reload teams
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
