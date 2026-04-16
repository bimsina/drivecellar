import type { CSSProperties } from 'react'

export const COLOR_PALETTE = [
  { key: 'red', label: 'Red', value: 'oklch(0.63 0.24 25)' },
  { key: 'orange', label: 'Orange', value: 'oklch(0.70 0.18 55)' },
  { key: 'amber', label: 'Amber', value: 'oklch(0.75 0.17 75)' },
  { key: 'yellow', label: 'Yellow', value: 'oklch(0.80 0.16 95)' },
  { key: 'lime', label: 'Lime', value: 'oklch(0.75 0.19 130)' },
  { key: 'green', label: 'Green', value: 'oklch(0.65 0.19 150)' },
  { key: 'emerald', label: 'Emerald', value: 'oklch(0.65 0.17 165)' },
  { key: 'teal', label: 'Teal', value: 'oklch(0.65 0.13 185)' },
  { key: 'cyan', label: 'Cyan', value: 'oklch(0.70 0.14 200)' },
  { key: 'blue', label: 'Blue', value: 'oklch(0.60 0.18 250)' },
  { key: 'indigo', label: 'Indigo', value: 'oklch(0.55 0.18 275)' },
  { key: 'violet', label: 'Violet', value: 'oklch(0.58 0.21 295)' },
  { key: 'purple', label: 'Purple', value: 'oklch(0.55 0.22 305)' },
  { key: 'pink', label: 'Pink', value: 'oklch(0.65 0.22 350)' },
  { key: 'rose', label: 'Rose', value: 'oklch(0.62 0.24 10)' },
  { key: 'slate', label: 'Slate', value: 'oklch(0.55 0.02 260)' },
] as const

export type ColorKey = (typeof COLOR_PALETTE)[number]['key']

export function getPaletteColor(key: string | null | undefined) {
  if (!key) {
    return null
  }

  return COLOR_PALETTE.find((entry) => entry.key === key) ?? null
}

export function getPaletteSwatchStyle(
  key: string | null | undefined,
): CSSProperties | undefined {
  const color = getPaletteColor(key)
  if (!color) {
    return undefined
  }

  return {
    backgroundColor: color.value,
    borderColor: color.value,
  }
}

export function getPaletteIconBadgeStyle(
  key: string | null | undefined,
): CSSProperties | undefined {
  const color = getPaletteColor(key)
  if (!color) {
    return undefined
  }

  return {
    color: color.value,
    backgroundColor: `color-mix(in oklab, ${color.value} 16%, transparent)`,
    borderColor: `color-mix(in oklab, ${color.value} 32%, transparent)`,
  }
}
