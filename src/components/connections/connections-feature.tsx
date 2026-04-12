import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type {
  CreateConnectionInput,
  UpdateConnectionInput,
} from '#/lib/connections.ts'

import { useTRPC } from '#/integrations/trpc/react'

import { ConnectionsWorkspace } from './connections-workspace'

type ConnectionsFeatureProps = {
  activeOrganizationId: string | null
}

export function ConnectionsFeature({
  activeOrganizationId,
}: ConnectionsFeatureProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
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

  async function handleCreateConnection(input: CreateConnectionInput) {
    try {
      const connection = await createConnectionMutation.mutateAsync(input)
      toast.success(`Created ${connection.name}.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create connection.'
      toast.error(message)
      throw error
    }
  }

  async function handleUpdateConnection(input: UpdateConnectionInput) {
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

  return (
    <ConnectionsWorkspace
      key={activeOrganizationId ?? 'no-active-organization'}
      connections={connectionsQuery.data ?? []}
      isLoading={connectionsQuery.isPending}
      isRefreshing={connectionsQuery.isRefetching}
      isDeleting={deleteConnectionMutation.isPending}
      errorMessage={
        activeOrganizationId
          ? (connectionsQuery.error?.message ?? null)
          : 'Choose an active organization from the header to load connections.'
      }
      onCreate={handleCreateConnection}
      onDelete={handleDeleteConnection}
      onUpdate={handleUpdateConnection}
    />
  )
}
