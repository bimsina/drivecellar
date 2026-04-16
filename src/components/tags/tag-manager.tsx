import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { ColorPicker } from '#/components/ui/color-picker'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Separator } from '#/components/ui/separator'
import { useTRPC } from '#/integrations/trpc/react'
import type { ColorKeyInput } from '#/lib/tags.ts'

type TagManagerProps = {
  connectionId: string
  path: string
  currentTagIds: string[]
  onChanged?: () => void
  trigger: React.ReactNode
}

export function TagManager({
  connectionId,
  path,
  currentTagIds,
  onChanged,
  trigger,
}: TagManagerProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState<ColorKeyInput | null>('blue')

  const tagsQuery = useQuery(trpc.tags.list.queryOptions())
  const assignMutation = useMutation(trpc.tags.assign.mutationOptions())
  const removeMutation = useMutation(trpc.tags.remove.mutationOptions())
  const createMutation = useMutation(trpc.tags.create.mutationOptions())

  const allTags = tagsQuery.data ?? []
  const normalizedQuery = query.trim().toLowerCase()
  const filteredTags = normalizedQuery
    ? allTags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery))
    : allTags

  async function notifyChanged() {
    await Promise.all([
      queryClient.invalidateQueries(trpc.tags.list.queryFilter()),
      queryClient.invalidateQueries(trpc.tags.listForFiles.queryFilter()),
    ])
    onChanged?.()
  }

  async function toggleTag(tagId: string, checked: boolean) {
    try {
      if (checked) {
        await assignMutation.mutateAsync({ tagId, connectionId, path })
      } else {
        await removeMutation.mutateAsync({ tagId, connectionId, path })
      }
      await notifyChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update tags.',
      )
    }
  }

  async function createTag() {
    if (!newTagName.trim() || !newTagColor) {
      return
    }

    try {
      const createdTag = await createMutation.mutateAsync({
        name: newTagName.trim(),
        color: newTagColor,
      })
      await assignMutation.mutateAsync({
        tagId: createdTag.id,
        connectionId,
        path,
      })
      setNewTagName('')
      await notifyChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create tag.',
      )
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tags"
          />
          <ScrollArea className="max-h-56 rounded-md border">
            <div className="space-y-1 p-2">
              {filteredTags.length === 0 ? (
                <p className="text-muted-foreground px-1 py-3 text-xs">
                  No tags found.
                </p>
              ) : (
                filteredTags.map((tag) => {
                  const checked = currentTagIds.includes(tag.id)
                  return (
                    <label
                      key={tag.id}
                      className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) =>
                          void toggleTag(tag.id, Boolean(nextChecked))
                        }
                      />
                      <span className="text-sm">{tag.name}</span>
                    </label>
                  )
                })
              )}
            </div>
          </ScrollArea>
          <Separator />
          <div className="space-y-2">
            <Input
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              placeholder="Create a new tag"
            />
            <ColorPicker
              value={newTagColor}
              onChange={setNewTagColor}
              allowClear={false}
            />
            <Button
              type="button"
              className="w-full"
              onClick={() => void createTag()}
              disabled={!newTagName.trim() || !newTagColor}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
