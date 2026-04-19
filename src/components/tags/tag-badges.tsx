import type { TagListItem } from '#/lib/tags.ts'
import { TagChip } from '#/components/tags/tag-chip'
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
        <TagChip key={tag.id} color={tag.color} label={tag.name} size={size} />
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            'text-muted-foreground bg-muted inline-flex items-center rounded-sm border border-transparent px-2 py-0.5 font-medium',
            size === 'sm' ? 'min-h-4 text-[10px]' : 'min-h-5 text-xs',
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  )
}
