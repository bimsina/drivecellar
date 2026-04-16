import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { ColorPicker } from '#/components/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { FieldError } from '#/components/ui/field-error'
import { IconPicker } from '#/components/ui/icon-picker'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { useTRPC } from '#/integrations/trpc/react'
import { normalizePath, PathError } from '#/lib/storage/path-utils'

type CreateFolderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  /** Current directory path (e.g. `/docs`). */
  parentPath: string
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  connectionId,
  parentPath,
}: CreateFolderDialogProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const nameId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [color, setColor] = useState<string | null>(null)
  const [icon, setIcon] = useState<string | null>(null)

  const mkdirMutation = useMutation(
    trpc.files.mkdir.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.files.list.queryFilter({
            connectionId,
            path: parentPath,
          }),
        )
        toast.success('Folder created.')
        setName('')
        setError(null)
        setColor(null)
        setIcon(null)
        setShowCustomize(false)
        onOpenChange(false)
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : 'Could not create folder.')
      },
    }),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a folder name.')
      return
    }

    let targetPath: string
    try {
      const suffix = trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
      const raw = parentPath === '/' ? `/${suffix}` : `${parentPath}/${suffix}`
      targetPath = normalizePath(raw)
    } catch (err) {
      if (err instanceof PathError) {
        setError(err.message)
      }
      return
    }

    setError(null)
    mkdirMutation.mutate({ connectionId, path: targetPath, color, icon })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card border sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>
              Add a new folder inside the current location for this drive.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              placeholder="Quarterly planning"
              autoComplete="off"
              disabled={mkdirMutation.isPending}
            />
            {error ? <FieldError errors={[error]} /> : null}
            <button
              type="button"
              onClick={() => setShowCustomize((current) => !current)}
              className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs"
            >
              <ChevronDown
                className={showCustomize ? 'size-3.5 rotate-180' : 'size-3.5'}
              />
              Customize
            </button>
            {showCustomize ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <ColorPicker value={color} onChange={setColor} />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <IconPicker value={icon} onChange={setIcon} />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mkdirMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mkdirMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
