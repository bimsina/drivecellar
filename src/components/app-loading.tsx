import { Loader2 } from 'lucide-react'

type AppLoadingProps = {
  label?: string
}

/** Centered spinner for shell-level loading (no cards or borders). */
export function AppLoading({ label = 'Loading…' }: AppLoadingProps) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="bg-card border-border/70 flex size-12 items-center justify-center rounded-sm border">
        <Loader2 className="text-primary size-6 animate-spin" aria-hidden />
      </div>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
    </div>
  )
}
