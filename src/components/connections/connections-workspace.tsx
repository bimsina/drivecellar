import { useEffect, useState } from 'react'

import type {
  ConnectionConfig,
  CreateConnectionInput,
  ConnectionListItem,
  UpdateConnectionInput,
} from '#/lib/connections.ts'
import { ConnectionFormDialog } from './connection-form-dialog'
import { ConnectionsGrid } from './connections-grid'
import { DeleteConnectionDialog } from './delete-connection-dialog'

type ConnectionsWorkspaceProps = {
  connections: ConnectionListItem[]
  canManageConnections: boolean
  isLoading: boolean
  isRefreshing?: boolean
  errorMessage?: string | null
  isDeleting?: boolean
  onCreate: (input: CreateConnectionInput) => Promise<void>
  onUpdate: (input: UpdateConnectionInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onManageIndexing: (connection: ConnectionListItem) => void
  testBeforeCreate?: (config: ConnectionConfig) => Promise<void>
}

export function ConnectionsWorkspace({
  connections,
  canManageConnections,
  isLoading,
  isRefreshing = false,
  errorMessage,
  isDeleting = false,
  onCreate,
  onUpdate,
  onDelete,
  onManageIndexing,
  testBeforeCreate,
}: ConnectionsWorkspaceProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingConnection, setEditingConnection] =
    useState<ConnectionListItem | null>(null)
  const [deletingConnection, setDeletingConnection] =
    useState<ConnectionListItem | null>(null)

  useEffect(() => {
    if (canManageConnections) {
      return
    }

    setCreateOpen(false)
    setEditingConnection(null)
    setDeletingConnection(null)
  }, [canManageConnections])

  return (
    <>
      <main className="mx-auto flex w-full min-w-0 flex-1 flex-col gap-4">
        <ConnectionsGrid
          canManageConnections={canManageConnections}
          connections={connections}
          errorMessage={errorMessage}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onCreate={() => {
            if (!canManageConnections) {
              return
            }
            setCreateOpen(true)
          }}
          onDelete={(connection) => {
            if (!canManageConnections) {
              return
            }
            setDeletingConnection(connection)
          }}
          onEdit={(connection) => {
            if (!canManageConnections) {
              return
            }
            setEditingConnection(connection)
          }}
          onManageIndexing={(connection) => {
            if (!canManageConnections) {
              return
            }
            onManageIndexing(connection)
          }}
        />
      </main>

      {canManageConnections && createOpen ? (
        <ConnectionFormDialog
          key="create-connection"
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          testBeforeCreate={testBeforeCreate}
          onSubmit={async (input) => {
            await onCreate(input as CreateConnectionInput)
          }}
        />
      ) : null}

      {canManageConnections && editingConnection ? (
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

      {canManageConnections ? (
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
      ) : null}
    </>
  )
}
