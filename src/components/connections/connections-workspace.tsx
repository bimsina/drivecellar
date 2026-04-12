import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import type {
  CreateConnectionInput,
  ConnectionListItem,
  UpdateConnectionInput,
} from '#/lib/connections.ts'
import { ConnectionFormDialog } from './connection-form-dialog'
import { ConnectionsGrid } from './connections-grid'
import { DeleteConnectionDialog } from './delete-connection-dialog'

type ConnectionsWorkspaceProps = {
  connections: ConnectionListItem[]
  isLoading: boolean
  isRefreshing?: boolean
  errorMessage?: string | null
  isDeleting?: boolean
  onCreate: (input: CreateConnectionInput) => Promise<void>
  onUpdate: (input: UpdateConnectionInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ConnectionsWorkspace({
  connections,
  isLoading,
  isRefreshing = false,
  errorMessage,
  isDeleting = false,
  onCreate,
  onUpdate,
  onDelete,
}: ConnectionsWorkspaceProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingConnection, setEditingConnection] =
    useState<ConnectionListItem | null>(null)
  const [deletingConnection, setDeletingConnection] =
    useState<ConnectionListItem | null>(null)

  return (
    <>
      <ConnectionsGrid
        connections={connections}
        errorMessage={errorMessage}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onDelete={setDeletingConnection}
        onEdit={setEditingConnection}
      />

      {!isLoading ? (
        <Button
          size="icon"
          className="fixed right-6 bottom-6 z-20 size-14 rounded-full shadow-lg sm:right-8 sm:bottom-8"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-5" />
          <span className="sr-only">Create connection</span>
        </Button>
      ) : null}

      {createOpen ? (
        <ConnectionFormDialog
          key="create-connection"
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={async (input) => {
            await onCreate(input as CreateConnectionInput)
          }}
        />
      ) : null}

      {editingConnection ? (
        <ConnectionFormDialog
          key={`edit-${editingConnection.id}`}
          mode="edit"
          open
          connection={editingConnection}
          onOpenChange={(open) => {
            if (!open) {
              setEditingConnection(null)
            }
          }}
          onSubmit={async (input) => {
            await onUpdate(input as UpdateConnectionInput)
            setEditingConnection(null)
          }}
        />
      ) : null}

      <DeleteConnectionDialog
        connection={deletingConnection}
        open={Boolean(deletingConnection)}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingConnection(null)
          }
        }}
        onConfirm={async () => {
          if (!deletingConnection) {
            return
          }

          await onDelete(deletingConnection.id)
          setDeletingConnection(null)
        }}
      />
    </>
  )
}
