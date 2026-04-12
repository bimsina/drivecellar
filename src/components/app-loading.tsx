import { Loader2 } from 'lucide-react'

type AppLoadingProps = {
  label?: string
}

/** Centered spinner for shell-level loading (no cards or borders). */
export function AppLoading({ label = 'Loading…' }: AppLoadingProps) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 p-8"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <Loader2
        className="text-muted-foreground size-8 animate-spin"
        aria-hidden
      />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}
