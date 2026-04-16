import { Badge } from '#/components/ui/badge'
import { getPaletteSwatchStyle } from '#/lib/color-palette.ts'
import type { TagListItem } from '#/lib/tags.ts'
import { cn } from '#/lib/utils'

type TagBadgesProps = {
  tags: TagListItem[]
  maxVisible?: number
  size?: 'sm' | 'default'
}

export function TagBadges({
  tags,
  maxVisible = 2,
  size = 'default',
}: TagBadgesProps) {
  if (tags.length === 0) {
    return null
  }

  const visible = tags.slice(0, maxVisible)
  const overflow = tags.length - visible.length

  return (
    <span className="inline-flex items-center gap-1">
      {visible.map((tag) => (
        <Badge
          key={tag.id}
          style={getPaletteSwatchStyle(tag.color)}
          className={cn(
            'border-none text-white',
            size === 'sm' ? 'h-4 text-[10px]' : 'h-5 text-xs',
          )}
        >
          {tag.name}
        </Badge>
      ))}
      {overflow > 0 ? (
        <Badge
          variant="secondary"
          className={size === 'sm' ? 'h-4 text-[10px]' : 'h-5 text-xs'}
        >
          +{overflow}
        </Badge>
      ) : null}
    </span>
  )
}
