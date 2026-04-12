import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { FieldError } from '#/components/ui/field-error'
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
    mkdirMutation.mutate({ connectionId, path: targetPath })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card border shadow-sm sm:max-w-md">
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
