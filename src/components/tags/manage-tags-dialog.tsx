import { useEffect, useMemo, useState } from 'react'
import { PencilLine, Tag as TagIcon, Trash2 } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { ColorPicker } from '#/components/ui/color-picker'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { ScrollArea } from '#/components/ui/scroll-area'
import { TagChip } from '#/components/tags/tag-chip'
import type { ColorKeyInput, Tag } from '#/lib/tags.ts'
import { cn } from '#/lib/utils'

type ManageTagsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: Tag[]
  currentTagIds: string[]
  onSave: (input: {
    id: string
    name: string
    color: ColorKeyInput
  }) => Promise<void>
  onDelete: (tag: Tag) => Promise<void>
  isSaving: boolean
  isDeleting: boolean
}

function formatTagPermissionLabel({
  canManage,
  isAssigned,
}: {
  canManage: boolean
  isAssigned: boolean
}) {
  if (canManage && isAssigned) {
    return 'Assigned here and editable'
  }
  if (canManage) {
    return 'Editable by you'
  }
  if (isAssigned) {
    return 'Assigned here, but only the creator or an admin can edit it'
  }
  return 'Only the creator or an admin can edit it'
}

export function ManageTagsDialog({
  open,
  onOpenChange,
  tags,
  currentTagIds,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: ManageTagsDialogProps) {
  const { data: session } = authClient.useSession()
  const activeOrganization = authClient.useActiveOrganization()
  const [query, setQuery] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState<ColorKeyInput>('blue')
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  const currentUserId = session?.user.id ?? null
  const currentMember = activeOrganization.data?.members?.find(
    (member) => member.userId === currentUserId,
  )
  const isAdmin =
    currentMember?.role === 'owner' || currentMember?.role === 'admin'

  useEffect(() => {
    if (!open) {
      setQuery('')
      setEditingTagId(null)
      setDeleteTarget(null)
    }
  }, [open])

  const filteredTags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const sortedTags = [...tags].sort((left, right) => {
      const leftAssigned = currentTagIds.includes(left.id)
      const rightAssigned = currentTagIds.includes(right.id)
      if (leftAssigned !== rightAssigned) {
        return leftAssigned ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })

    if (!normalizedQuery) {
      return sortedTags
    }

    return sortedTags.filter((tag) =>
      tag.name.toLowerCase().includes(normalizedQuery),
    )
  }, [currentTagIds, query, tags])

  function startEditing(tag: Tag) {
    setEditingTagId(tag.id)
    setDraftName(tag.name)
    setDraftColor(tag.color)
  }

  function stopEditing() {
    setEditingTagId(null)
    setDraftName('')
    setDraftColor('blue')
  }

  async function saveTag(tag: Tag) {
    const nextName = draftName.trim()
    if (!nextName) {
      return
    }

    await onSave({
      id: tag.id,
      name: nextName,
      color: draftColor,
    })
    stopEditing()
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    await onDelete(deleteTarget)
    setDeleteTarget(null)
    if (editingTagId === deleteTarget.id) {
      stopEditing()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(100vw-2rem,44rem)] max-w-none p-0 sm:max-w-2xl">
          <DialogHeader className="border-border/60 border-b px-5 py-4">
            <DialogTitle>Manage tags</DialogTitle>
            <DialogDescription>
              Rename, recolor, and clean up your organization&apos;s tags
              without leaving the tagging flow.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pt-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tags"
              aria-label="Search tags"
            />
          </div>

          <ScrollArea className="max-h-[min(60vh,34rem)] px-3 pb-3">
            <div className="space-y-2 p-2">
              {filteredTags.length === 0 ? (
                <div className="text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 rounded-sm border border-dashed text-center text-sm">
                  <TagIcon className="size-5" />
                  <p>No tags match this search.</p>
                </div>
              ) : (
                filteredTags.map((tag) => {
                  const canManage = isAdmin || tag.createdBy === currentUserId
                  const isAssigned = currentTagIds.includes(tag.id)
                  const isEditing = editingTagId === tag.id

                  return (
                    <div
                      key={tag.id}
                      className={cn(
                        'rounded-sm border px-3 py-3 transition-colors',
                        isEditing
                          ? 'border-border/80 bg-muted/35'
                          : 'hover:bg-muted/35 border-transparent',
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <TagChip
                              color={draftColor}
                              label={draftName.trim() || 'Untitled tag'}
                            />
                            {isAssigned ? (
                              <span className="text-muted-foreground text-xs">
                                Assigned to this item
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={draftName}
                              onChange={(event) =>
                                setDraftName(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void saveTag(tag)
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  stopEditing()
                                }
                              }}
                              className="min-w-52 flex-1"
                              autoFocus
                              aria-label={`Rename ${tag.name}`}
                            />
                            <ColorPicker
                              value={draftColor}
                              onChange={(nextColor) => {
                                if (nextColor) {
                                  setDraftColor(nextColor)
                                }
                              }}
                              allowClear={false}
                              size="compact"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void saveTag(tag)}
                              disabled={isSaving || !draftName.trim()}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={stopEditing}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <TagChip color={tag.color} label={tag.name} />
                              {isAssigned ? (
                                <span className="text-muted-foreground text-xs">
                                  Assigned here
                                </span>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground mt-2 text-xs">
                              {formatTagPermissionLabel({
                                canManage,
                                isAssigned,
                              })}
                            </p>
                          </div>
                          {canManage ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${tag.name}`}
                                onClick={() => startEditing(tag)}
                              >
                                <PencilLine className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Delete ${tag.name}`}
                                onClick={() => setDeleteTarget(tag)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground shrink-0 text-xs">
                              Read only
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will remove "${deleteTarget.name}" from every tagged item in the organization.`
                : 'This will remove the selected tag from every tagged item in the organization.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
