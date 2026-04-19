import type { CSSProperties } from 'react'

function createPaletteColor<const TKey extends string>({
  key,
  label,
  value,
  recommended = true,
}: {
  key: TKey
  label: string
  value: string
  recommended?: boolean
}) {
  return {
    key,
    label,
    value,
    recommended,
    chipBackground: `color-mix(in oklab, ${value} 14%, var(--card))`,
    chipBorder: `color-mix(in oklab, ${value} 28%, var(--border))`,
    chipForeground: `color-mix(in oklab, ${value} 70%, var(--foreground))`,
    ringColor: `color-mix(in oklab, ${value} 34%, transparent)`,
  }
}

export const COLOR_PALETTE = [
  createPaletteColor({
    key: 'red',
    label: 'Red',
    value: 'oklch(0.63 0.24 25)',
  }),
  createPaletteColor({
    key: 'orange',
    label: 'Orange',
    value: 'oklch(0.70 0.18 55)',
  }),
  createPaletteColor({
    key: 'amber',
    label: 'Amber',
    value: 'oklch(0.75 0.17 75)',
  }),
  createPaletteColor({
    key: 'yellow',
    label: 'Yellow',
    value: 'oklch(0.80 0.16 95)',
    recommended: false,
  }),
  createPaletteColor({
    key: 'lime',
    label: 'Lime',
    value: 'oklch(0.75 0.19 130)',
    recommended: false,
  }),
  createPaletteColor({
    key: 'green',
    label: 'Green',
    value: 'oklch(0.65 0.19 150)',
  }),
  createPaletteColor({
    key: 'emerald',
    label: 'Emerald',
    value: 'oklch(0.65 0.17 165)',
  }),
  createPaletteColor({
    key: 'teal',
    label: 'Teal',
    value: 'oklch(0.65 0.13 185)',
  }),
  createPaletteColor({
    key: 'cyan',
    label: 'Cyan',
    value: 'oklch(0.70 0.14 200)',
    recommended: false,
  }),
  createPaletteColor({
    key: 'blue',
    label: 'Blue',
    value: 'oklch(0.60 0.18 250)',
  }),
  createPaletteColor({
    key: 'indigo',
    label: 'Indigo',
    value: 'oklch(0.55 0.18 275)',
  }),
  createPaletteColor({
    key: 'violet',
    label: 'Violet',
    value: 'oklch(0.58 0.21 295)',
  }),
  createPaletteColor({
    key: 'purple',
    label: 'Purple',
    value: 'oklch(0.55 0.22 305)',
    recommended: false,
  }),
  createPaletteColor({
    key: 'pink',
    label: 'Pink',
    value: 'oklch(0.65 0.22 350)',
    recommended: false,
  }),
  createPaletteColor({
    key: 'rose',
    label: 'Rose',
    value: 'oklch(0.62 0.24 10)',
    recommended: false,
  }),
  createPaletteColor({
    key: 'slate',
    label: 'Slate',
    value: 'oklch(0.55 0.02 260)',
  }),
] as const

export type ColorKey = (typeof COLOR_PALETTE)[number]['key']

const RECOMMENDED_COLOR_KEYS = COLOR_PALETTE.filter(
  (entry) => entry.recommended,
).map((entry) => entry.key)

const SEMANTIC_COLOR_MATCHERS: Array<{
  color: ColorKey
  keywords: string[]
}> = [
  {
    color: 'red',
    keywords: ['urgent', 'error', 'issue', 'block', 'blocked', 'risk'],
  },
  {
    color: 'amber',
    keywords: ['warning', 'follow up', 'review', 'pending'],
  },
  {
    color: 'green',
    keywords: ['done', 'ready', 'approved', 'complete', 'live'],
  },
  {
    color: 'blue',
    keywords: ['docs', 'doc', 'reference', 'spec', 'info'],
  },
  {
    color: 'teal',
    keywords: ['design', 'ui', 'ux', 'creative'],
  },
  {
    color: 'slate',
    keywords: ['archive', 'later', 'backlog', 'misc'],
  },
]

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

export function getPaletteChipStyle(
  key: string | null | undefined,
): CSSProperties | undefined {
  const color = getPaletteColor(key)
  if (!color) {
    return undefined
  }

  return {
    color: color.chipForeground,
    backgroundColor: color.chipBackground,
    borderColor: color.chipBorder,
  }
}

export function getPaletteRingStyle(
  key: string | null | undefined,
): CSSProperties | undefined {
  const color = getPaletteColor(key)
  if (!color) {
    return undefined
  }

  return {
    '--tag-ring-color': color.ringColor,
  } as CSSProperties
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

function normalizeSeed(seed: string) {
  return seed.trim().toLowerCase()
}

function hashSeed(seed: string) {
  let hash = 0
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash
}

export function getRecommendedPaletteColor(seed: string): ColorKey {
  const normalizedSeed = normalizeSeed(seed)
  if (!normalizedSeed) {
    return 'blue'
  }

  const semanticMatch = SEMANTIC_COLOR_MATCHERS.find((matcher) =>
    matcher.keywords.some((keyword) => normalizedSeed.includes(keyword)),
  )
  if (semanticMatch) {
    return semanticMatch.color
  }

  return (
    RECOMMENDED_COLOR_KEYS[
      hashSeed(normalizedSeed) % RECOMMENDED_COLOR_KEYS.length
    ] ?? 'blue'
  )
}
