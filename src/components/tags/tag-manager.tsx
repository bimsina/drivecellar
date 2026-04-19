import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Plus, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { ColorPicker } from '#/components/ui/color-picker'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { useTRPC } from '#/integrations/trpc/react'
import {
  getRecommendedPaletteColor,
  getPaletteRingStyle,
  getPaletteSwatchStyle,
} from '#/lib/color-palette.ts'
import type { ColorKeyInput, Tag } from '#/lib/tags.ts'
import { cn } from '#/lib/utils'
import { ManageTagsDialog } from '#/components/tags/manage-tags-dialog'
import { TagChip } from '#/components/tags/tag-chip'

type TagManagerProps = {
  connectionId: string
  path: string
  currentTagIds: string[]
  onChanged?: () => void
  trigger: ReactNode
}

function normalizeTagName(value: string) {
  return value.trim().toLowerCase()
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
  const [open, setOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState(currentTagIds)
  const [newTagColor, setNewTagColor] = useState<ColorKeyInput>('blue')
  const [hasManualColorChoice, setHasManualColorChoice] = useState(false)
  const previousNormalizedQueryRef = useRef('')

  const tagsQuery = useQuery(trpc.tags.list.queryOptions())
  const assignMutation = useMutation(trpc.tags.assign.mutationOptions())
  const removeMutation = useMutation(trpc.tags.remove.mutationOptions())
  const createMutation = useMutation(trpc.tags.create.mutationOptions())
  const updateMutation = useMutation(trpc.tags.update.mutationOptions())
  const deleteMutation = useMutation(trpc.tags.delete.mutationOptions())

  const allTags = tagsQuery.data ?? []
  const normalizedQuery = normalizeTagName(query)

  useEffect(() => {
    setSelectedTagIds(currentTagIds)
  }, [currentTagIds])

  useEffect(() => {
    const previousNormalizedQuery = previousNormalizedQueryRef.current

    if (!normalizedQuery) {
      setHasManualColorChoice(false)
      setNewTagColor('blue')
      previousNormalizedQueryRef.current = ''
      return
    }

    if (!previousNormalizedQuery && !hasManualColorChoice) {
      setNewTagColor(getRecommendedPaletteColor(normalizedQuery))
    }

    previousNormalizedQueryRef.current = normalizedQuery
  }, [hasManualColorChoice, normalizedQuery])

  const selectedTagSet = useMemo(
    () => new Set(selectedTagIds),
    [selectedTagIds],
  )

  const assignedTags = useMemo(
    () =>
      allTags
        .filter((tag) => selectedTagSet.has(tag.id))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [allTags, selectedTagSet],
  )

  const filteredTags = useMemo(() => {
    const matchingTags = normalizedQuery
      ? allTags.filter((tag) =>
          tag.name.toLowerCase().includes(normalizedQuery),
        )
      : allTags

    return [...matchingTags].sort((left, right) => {
      const leftAssigned = selectedTagSet.has(left.id)
      const rightAssigned = selectedTagSet.has(right.id)
      if (leftAssigned !== rightAssigned) {
        return leftAssigned ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
  }, [allTags, normalizedQuery, selectedTagSet])

  const exactMatch = useMemo(
    () =>
      allTags.find((tag) => normalizeTagName(tag.name) === normalizedQuery) ??
      null,
    [allTags, normalizedQuery],
  )
  const canCreateTag = Boolean(normalizedQuery) && !exactMatch

  async function notifyChanged() {
    await Promise.all([
      queryClient.invalidateQueries(trpc.tags.list.queryFilter()),
      queryClient.invalidateQueries(trpc.tags.listForFiles.queryFilter()),
    ])
    onChanged?.()
  }

  function resetComposer() {
    setQuery('')
    setNewTagColor('blue')
    setHasManualColorChoice(false)
  }

  async function toggleTag(tagId: string, checked: boolean) {
    const previousTagIds = selectedTagIds
    setSelectedTagIds((current) =>
      checked
        ? Array.from(new Set([...current, tagId]))
        : current.filter((currentTagId) => currentTagId !== tagId),
    )

    try {
      if (checked) {
        await assignMutation.mutateAsync({ tagId, connectionId, path })
      } else {
        await removeMutation.mutateAsync({ tagId, connectionId, path })
      }
      await notifyChanged()
    } catch (error) {
      setSelectedTagIds(previousTagIds)
      toast.error(
        error instanceof Error ? error.message : 'Could not update tags.',
      )
    }
  }

  async function createTag() {
    const nextName = query.trim()
    if (!nextName || !canCreateTag) {
      return
    }

    const previousTagIds = selectedTagIds
    try {
      const createdTag = await createMutation.mutateAsync({
        name: nextName,
        color: newTagColor,
      })
      setSelectedTagIds((current) => [...current, createdTag.id])
      await assignMutation.mutateAsync({
        tagId: createdTag.id,
        connectionId,
        path,
      })
      resetComposer()
      await notifyChanged()
    } catch (error) {
      setSelectedTagIds(previousTagIds)
      toast.error(
        error instanceof Error ? error.message : 'Could not create tag.',
      )
    }
  }

  async function updateTag(input: {
    id: string
    name: string
    color: ColorKeyInput
  }) {
    try {
      await updateMutation.mutateAsync(input)
      await notifyChanged()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update tag.',
      )
      throw error
    }
  }

  async function deleteTag(tag: Tag) {
    const previousTagIds = selectedTagIds
    try {
      setSelectedTagIds((current) =>
        current.filter((currentTagId) => currentTagId !== tag.id),
      )
      await deleteMutation.mutateAsync({ id: tag.id })
      await notifyChanged()
    } catch (error) {
      setSelectedTagIds(previousTagIds)
      toast.error(
        error instanceof Error ? error.message : 'Could not delete tag.',
      )
      throw error
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            resetComposer()
          }
        }}
      >
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent
          showCloseButton={false}
          className="top-[16vh] w-[22rem] max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[22rem]"
        >
          <DialogHeader className="border-border/60 bg-card/90 border-b px-3 py-3">
            <DialogTitle className="text-sm font-medium">Tags</DialogTitle>
            <DialogDescription className="text-xs">
              Search, assign, or create a new tag without leaving the file list.
            </DialogDescription>
          </DialogHeader>

          <div className="border-border/60 bg-card/90 border-b px-3 py-3 pt-0">
            <div className="border-border/70 bg-muted/20 rounded-2xl border p-2.5">
              <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-[0.16em] uppercase">
                Assigned
              </p>
              {assignedTags.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No tags yet for this item.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {assignedTags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      color={tag.color}
                      label={tag.name}
                      removeLabel={`Remove ${tag.name}`}
                      onRemove={() => void toggleTag(tag.id, false)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <Command className="bg-transparent p-0">
            <div className="border-border/60 border-b px-2 py-2">
              <CommandInput
                autoFocus
                value={query}
                onValueChange={setQuery}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canCreateTag) {
                    event.preventDefault()
                    void createTag()
                  }
                }}
                placeholder="Search or create tags"
                aria-label="Search or create tags"
                className="border-0 py-2 shadow-none focus-visible:ring-0"
              />

              {canCreateTag ? (
                <div className="border-border/70 bg-muted/20 mt-2 flex items-center gap-2 rounded-2xl border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
                      Create
                    </p>
                    <div className="mt-1">
                      <TagChip color={newTagColor} label={query.trim()} />
                    </div>
                  </div>
                  <ColorPicker
                    value={newTagColor}
                    onChange={(nextColor) => {
                      if (nextColor) {
                        setHasManualColorChoice(true)
                        setNewTagColor(nextColor)
                      }
                    }}
                    allowClear={false}
                    size="compact"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void createTag()}
                    disabled={createMutation.isPending}
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
              ) : null}
            </div>

            <CommandList className="max-h-64 p-1.5">
              {tagsQuery.isPending ? (
                <div className="text-muted-foreground px-2 py-8 text-center text-sm">
                  Loading tags…
                </div>
              ) : tagsQuery.isError ? (
                <div className="text-destructive px-2 py-8 text-center text-sm">
                  Could not load tags.
                </div>
              ) : filteredTags.length === 0 ? (
                <CommandEmpty className="text-muted-foreground px-2 py-8 text-sm">
                  {canCreateTag
                    ? 'Press Enter to create this tag.'
                    : 'No tags found.'}
                </CommandEmpty>
              ) : (
                <CommandGroup
                  heading={normalizedQuery ? 'Matches' : 'All tags'}
                >
                  {filteredTags.map((tag) => {
                    const checked = selectedTagSet.has(tag.id)

                    return (
                      <CommandItem
                        key={tag.id}
                        value={`${tag.name} ${tag.color}`}
                        data-checked={checked}
                        className={cn(
                          'rounded-xl px-2.5 py-2',
                          checked && 'bg-muted/40',
                        )}
                        style={getPaletteRingStyle(tag.color)}
                        onSelect={() => void toggleTag(tag.id, !checked)}
                      >
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full border border-current/20"
                          style={getPaletteSwatchStyle(tag.color)}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {tag.name}
                        </span>
                        {checked ? (
                          <span className="text-muted-foreground text-xs">
                            Assigned
                          </span>
                        ) : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>

          <div className="border-border/60 bg-muted/20 flex items-center justify-between border-t px-2.5 py-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5" />
              {allTags.length} total tag{allTags.length === 1 ? '' : 's'}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false)
                setManageOpen(true)
              }}
            >
              <Settings2 className="size-3.5" />
              Manage tags
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ManageTagsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        tags={allTags}
        currentTagIds={selectedTagIds}
        onSave={updateTag}
        onDelete={deleteTag}
        isSaving={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
    </>
  )
}
