import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { HardDrive } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type {
  ConnectionListItem,
  CreateConnectionInput,
  UpdateConnectionInput,
} from '#/lib/connections.ts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'

import { useTRPC } from '#/integrations/trpc/react'

import { ConnectionsWorkspace } from './connections-workspace'

type ConnectionsFeatureProps = {
  activeOrganizationId: string | null
}

export function ConnectionsFeature({
  activeOrganizationId,
}: ConnectionsFeatureProps) {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [createdConnection, setCreatedConnection] =
    useState<ConnectionListItem | null>(null)
  const adminOnlyMessage =
    'Only team owners and admins can manage permissions here.'
  const canLoadConnections = Boolean(activeOrganizationId)
  const queryInput = {
    organizationId: activeOrganizationId ?? '',
  }

  async function invalidateConnections() {
    if (!activeOrganizationId) {
      return
    }

    await queryClient.invalidateQueries(
      trpc.connections.list.queryFilter({
        organizationId: activeOrganizationId,
      }),
    )
  }

  const connectionsQuery = useQuery(
    trpc.connections.list.queryOptions(queryInput, {
      enabled: canLoadConnections,
    }),
  )
  const myRoleQuery = useQuery(
    trpc.connections.getMyOrganizationRole.queryOptions(queryInput, {
      enabled: canLoadConnections,
    }),
  )
  const canManageConnections =
    myRoleQuery.data?.canManageConnections === true && canLoadConnections

  const createConnectionMutation = useMutation(
    trpc.connections.create.mutationOptions({
      onSuccess: async () => {
        await invalidateConnections()
      },
    }),
  )

  const updateConnectionMutation = useMutation(
    trpc.connections.update.mutationOptions({
      onSuccess: async () => {
        await invalidateConnections()
      },
    }),
  )

  const deleteConnectionMutation = useMutation(
    trpc.connections.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateConnections()
      },
    }),
  )

  const testConnectionMutation = useMutation(
    trpc.connections.testConfig.mutationOptions(),
  )

  function assertCanManageConnections() {
    if (!canManageConnections) {
      throw new Error(adminOnlyMessage)
    }
  }

  async function handleCreateConnection(input: CreateConnectionInput) {
    assertCanManageConnections()

    try {
      const connection = await createConnectionMutation.mutateAsync(input)
      setCreatedConnection(connection)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create connection.'
      toast.error(message)
      throw error
    }
  }

  async function handleUpdateConnection(input: UpdateConnectionInput) {
    assertCanManageConnections()

    try {
      const connection = await updateConnectionMutation.mutateAsync(input)
      toast.success(`Saved ${connection.name}.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update connection.'
      toast.error(message)
      throw error
    }
  }

  async function handleDeleteConnection(id: string) {
    assertCanManageConnections()

    try {
      await deleteConnectionMutation.mutateAsync({ id })
      toast.success('Connection deleted.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete connection.'
      toast.error(message)
      throw error
    }
  }

  function handleManageIndexing(connection: ConnectionListItem) {
    void navigate({
      to: '/indexing/$cid',
      params: { cid: connection.id },
    })
  }

  return (
    <>
      <ConnectionsWorkspace
        key={activeOrganizationId ?? 'no-active-organization'}
        canManageConnections={canManageConnections}
        connections={connectionsQuery.data ?? []}
        isLoading={connectionsQuery.isPending}
        isRefreshing={connectionsQuery.isRefetching}
        isDeleting={deleteConnectionMutation.isPending}
        errorMessage={
          activeOrganizationId
            ? (connectionsQuery.error?.message ?? null)
            : 'Choose an active team from the header to load connections.'
        }
        onCreate={handleCreateConnection}
        onDelete={handleDeleteConnection}
        onUpdate={handleUpdateConnection}
        onManageIndexing={handleManageIndexing}
        testBeforeCreate={async (config) => {
          assertCanManageConnections()
          await testConnectionMutation.mutateAsync({ config })
        }}
      />

      <AlertDialog
        open={Boolean(createdConnection)}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedConnection(null)
          }
        }}
      >
        <AlertDialogContent className="border-border bg-card border">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HardDrive />
            </AlertDialogMedia>
            <AlertDialogTitle>Storage drive added</AlertDialogTitle>
            <AlertDialogDescription>
              {createdConnection
                ? `${createdConnection.name} is connected. Indexing is running in the background.`
                : 'Connection created successfully.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!createdConnection) {
                  return
                }

                void navigate({
                  to: '/indexing/$cid',
                  params: { cid: createdConnection.id },
                }).catch(() => {
                  if (typeof window !== 'undefined') {
                    window.location.assign(`/indexing/${createdConnection.id}`)
                  }
                })
              }}
            >
              View progress
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
