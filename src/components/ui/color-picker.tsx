import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { COLOR_PALETTE, getPaletteSwatchStyle } from '#/lib/color-palette.ts'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { cn } from '#/lib/utils'

type ColorPickerProps = {
  value: string | null
  onChange: (key: string | null) => void
  allowClear?: boolean
}

export function ColorPicker({
  value,
  onChange,
  allowClear = true,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const selectedColor = value
    ? (COLOR_PALETTE.find((entry) => entry.key === value) ?? null)
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <span
              className={cn(
                'border-border inline-flex size-4 rounded-full border',
                !selectedColor && 'border-dashed bg-transparent',
              )}
              style={
                selectedColor
                  ? getPaletteSwatchStyle(selectedColor.key)
                  : undefined
              }
            />
            <span className="text-muted-foreground">
              {selectedColor?.label ?? 'No color'}
            </span>
          </span>
          <ChevronDown className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <div className="grid grid-cols-4 gap-2">
          {allowClear ? (
            <button
              type="button"
              aria-label="Clear color"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className={cn(
                'border-border text-muted-foreground flex size-7 items-center justify-center rounded-full border border-dashed text-xs transition-colors',
                value === null && 'ring-primary ring-2',
              )}
            >
              None
            </button>
          ) : null}
          {COLOR_PALETTE.map((color) => {
            const isSelected = value === color.key
            return (
              <button
                key={color.key}
                type="button"
                aria-label={color.label}
                title={color.label}
                onClick={() => {
                  onChange(color.key)
                  setOpen(false)
                }}
                className={cn(
                  'text-primary-foreground flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-105',
                  isSelected && 'ring-primary ring-2',
                )}
                style={getPaletteSwatchStyle(color.key)}
              >
                {isSelected ? <Check className="size-3.5" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
