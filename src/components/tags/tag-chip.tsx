import { X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  getPaletteChipStyle,
  getPaletteRingStyle,
  getPaletteSwatchStyle,
} from '#/lib/color-palette.ts'
import { cn } from '#/lib/utils'

type TagChipProps = {
  color: string | null | undefined
  label: string
  size?: 'sm' | 'default'
  className?: string
  removeLabel?: string
  onRemove?: () => void
}

export function TagChip({
  color,
  label,
  size = 'default',
  className,
  removeLabel,
  onRemove,
}: TagChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-medium',
        size === 'sm' ? 'min-h-4 text-[10px]' : 'min-h-5 text-xs',
        onRemove && 'pr-0.5',
        className,
      )}
      style={{
        ...getPaletteChipStyle(color),
        ...getPaletteRingStyle(color),
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          'shrink-0 rounded-sm border border-current/20',
          size === 'sm' ? 'size-1.5' : 'size-2',
        )}
        style={getPaletteSwatchStyle(color)}
      />
      <span className="truncate">{label}</span>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(
            'hover:bg-foreground/8 size-4 rounded-sm text-inherit shadow-none',
            size === 'sm' && 'size-3.5',
          )}
          aria-label={removeLabel ?? `Remove ${label}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
          }}
        >
          <X className={size === 'sm' ? 'size-2.5' : 'size-3'} />
        </Button>
      ) : null}
    </span>
  )
}
