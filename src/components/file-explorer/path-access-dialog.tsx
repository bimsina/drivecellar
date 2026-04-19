import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Eye,
  FileIcon,
  FolderIcon,
  Loader2,
  PencilLine,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '#/lib/auth-client'
import type { PermissionAccess } from '#/lib/connections'
import { normalizePath } from '#/lib/storage/path-utils'
import { useTRPC } from '#/integrations/trpc/react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

type ActiveOrganization = NonNullable<
  ReturnType<typeof authClient.useActiveOrganization>['data']
>
type ActiveOrganizationMember = ActiveOrganization['members'][number]

function formatAccessLabel(access: PermissionAccess) {
  if (access === 'editor') {
    return 'Editor'
  }
  if (access === 'viewer') {
    return 'Viewer'
  }
  return 'No access'
}

function accessBadgeVariant(access: PermissionAccess) {
  if (access === 'editor') {
    return 'default'
  }
  if (access === 'viewer') {
    return 'secondary'
  }
  return 'outline'
}

function accessIcon(access: PermissionAccess) {
  if (access === 'editor') {
    return <PencilLine className="size-3" />
  }
  if (access === 'viewer') {
    return <Eye className="size-3" />
  }
  return <Shield className="size-3" />
}

function AccessBadge({ access }: { access: PermissionAccess }) {
  return (
    <Badge variant={accessBadgeVariant(access)} className="gap-1">
      {accessIcon(access)}
      {formatAccessLabel(access)}
    </Badge>
  )
}

function parseAccess(value: string): PermissionAccess {
  if (value === 'editor' || value === 'viewer' || value === 'none') {
    return value
  }

  return 'none'
}

function buildAncestorPaths(inputPath: string) {
  const normalizedPath = normalizePath(inputPath)

  if (normalizedPath === '/') {
    return []
  }

  const segments = normalizedPath.split('/').filter(Boolean)
  const paths: string[] = []

  for (let i = segments.length - 1; i >= 1; i -= 1) {
    paths.push(`/${segments.slice(0, i).join('/')}`)
  }

  paths.push('/')
  return paths
}

function getInheritedAccessForUser(args: {
  normalizedPath: string
  userId: string
  role: string
  defaultAccess: PermissionAccess
  ancestorEntries: Array<{
    userId: string
    path: string
    access: PermissionAccess
  }>
}) {
  if (args.role === 'owner' || args.role === 'admin') {
    return {
      access: 'editor' as const,
      source: 'Team admins always have full access.',
    }
  }

  const ancestorPaths = buildAncestorPaths(args.normalizedPath)

  for (const ancestorPath of ancestorPaths) {
    const match = args.ancestorEntries.find(
      (entry) => entry.userId === args.userId && entry.path === ancestorPath,
    )

    if (match) {
      return {
        access: match.access,
        source:
          match.path === '/'
            ? 'Inherited from the root folder.'
            : `Inherited from ${match.path}.`,
      }
    }
  }

  return {
    access: args.defaultAccess,
    source: 'Inherited from the connection default access.',
  }
}

function formatRole(role: string) {
  if (role === 'owner') {
    return 'Owner'
  }
  if (role === 'admin') {
    return 'Admin'
  }
  return 'Member'
}

function pathLabel(path: string) {
  const normalizedPath = normalizePath(path)

  if (normalizedPath === '/') {
    return 'Root folder'
  }

  return normalizedPath
}

type PathAccessDialogProps = {
  connectionId: string
  path: string
  itemName: string
  isDirectory: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onPermissionsChanged?: () => Promise<void> | void
}

export function PathAccessDialog({
  connectionId,
  path,
  itemName,
  isDirectory,
  open,
  onOpenChange,
  onPermissionsChanged,
}: PathAccessDialogProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const activeOrganization = authClient.useActiveOrganization()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedAccess, setSelectedAccess] =
    useState<PermissionAccess>('viewer')
  const normalizedPath = normalizePath(path)

  const connectionQuery = useQuery(
    trpc.connections.getById.queryOptions(
      { id: connectionId },
      {
        enabled: open && Boolean(connectionId),
      },
    ),
  )

  const exactAccessQuery = useQuery(
    trpc.permissions.getFolderAccess.queryOptions(
      {
        connectionId,
        path: normalizedPath,
      },
      {
        enabled: open && Boolean(connectionId),
      },
    ),
  )

  const allAccessQuery = useQuery(
    trpc.permissions.getFolderAccess.queryOptions(
      {
        connectionId,
      },
      {
        enabled: open && Boolean(connectionId),
      },
    ),
  )

  const members: ActiveOrganizationMember[] =
    activeOrganization.data?.members ?? []
  const exactEntries = exactAccessQuery.data ?? []
  const allEntries = allAccessQuery.data ?? []

  const exactEntryByUserId = useMemo(
    () =>
      new Map(
        exactEntries.map((entry) => [
          entry.userId,
          {
            ...entry,
            access: parseAccess(entry.access),
          },
        ]),
      ),
    [exactEntries],
  )

  const ancestorEntries = useMemo(
    () =>
      allEntries
        .filter((entry) => entry.path !== normalizedPath)
        .map((entry) => ({
          userId: entry.userId,
          path: entry.path,
          access: parseAccess(entry.access),
        })),
    [allEntries, normalizedPath],
  )

  const removableUnknownEntries = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.userId))

    return exactEntries.filter((entry) => !memberIds.has(entry.userId))
  }, [exactEntries, members])

  const memberRows = useMemo(() => {
    const defaultAccess = connectionQuery.data?.defaultAccess ?? 'none'

    return members
      .map((member: ActiveOrganizationMember) => {
        const inherited = getInheritedAccessForUser({
          normalizedPath,
          userId: member.userId,
          role: member.role,
          defaultAccess,
          ancestorEntries,
        })
        const explicit = exactEntryByUserId.get(member.userId)?.access ?? null

        return {
          id: member.id,
          userId: member.userId,
          name: member.user?.name ?? member.user?.email ?? 'Unknown member',
          email: member.user?.email ?? '',
          role: member.role,
          inheritedAccess: inherited.access,
          inheritedSource: inherited.source,
          explicitAccess: explicit,
          effectiveAccess: explicit ?? inherited.access,
        }
      })
      .sort((a, b) => {
        if (a.role !== b.role) {
          const rank = { owner: 0, admin: 1, member: 2 }
          return rank[a.role] - rank[b.role]
        }

        return a.name.localeCompare(b.name, undefined, {
          sensitivity: 'base',
        })
      })
  }, [
    ancestorEntries,
    connectionQuery.data?.defaultAccess,
    exactEntryByUserId,
    members,
    normalizedPath,
  ])

  const assignableMembers = useMemo(
    () =>
      memberRows.filter(
        (member) => member.role === 'member' && member.explicitAccess === null,
      ),
    [memberRows],
  )

  async function invalidatePermissionViews() {
    await Promise.all([
      queryClient.invalidateQueries(
        trpc.permissions.getFolderAccess.queryFilter({
          connectionId,
          path: normalizedPath,
        }),
      ),
      queryClient.invalidateQueries(
        trpc.permissions.getFolderAccess.queryFilter({
          connectionId,
        }),
      ),
      onPermissionsChanged?.(),
    ])
  }

  const setAccessMutation = useMutation(
    trpc.permissions.setFolderAccess.mutationOptions({
      onSuccess: async (_, variables) => {
        await invalidatePermissionViews()
        toast.success(`Saved access for ${variables.userId}.`)
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not save this access rule.',
        )
      },
    }),
  )

  const removeAccessMutation = useMutation(
    trpc.permissions.removeFolderAccess.mutationOptions({
      onSuccess: async () => {
        await invalidatePermissionViews()
        toast.success('Removed the explicit override.')
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not remove this access rule.',
        )
      },
    }),
  )

  const isLoading =
    connectionQuery.isPending ||
    exactAccessQuery.isPending ||
    allAccessQuery.isPending ||
    Boolean(activeOrganization.isPending)

  const loadError =
    (!session?.session.activeOrganizationId
      ? 'Select an active team to manage access.'
      : null) ??
    connectionQuery.error?.message ??
    exactAccessQuery.error?.message ??
    allAccessQuery.error?.message ??
    activeOrganization.error?.message ??
    null

  const isMutating =
    setAccessMutation.isPending || removeAccessMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDirectory ? (
              <FolderIcon className="text-primary size-5" />
            ) : (
              <FileIcon className="text-primary size-5" />
            )}
            Manage Access
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="text-foreground block font-medium">
              {itemName}
            </span>
            <span className="block">
              Configure explicit access for this{' '}
              {isDirectory ? 'folder' : 'file'}.
            </span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-sm" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-sm" />
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load permissions</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {isDirectory ? 'Folder' : 'File'}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-foreground font-medium break-all">
                  {pathLabel(normalizedPath)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Default</span>
                  <AccessBadge
                    access={connectionQuery.data?.defaultAccess ?? 'none'}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Direct overrides
                  </span>
                  <span className="text-foreground font-medium">
                    {exactEntries.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-border/60 border-t pt-4">
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                <div className="min-w-0 space-y-2 md:w-[18rem] md:max-w-[18rem] md:flex-none">
                  <p className="text-foreground text-sm font-medium">
                    Add a direct override
                  </p>
                  <Select
                    value={selectedUserId}
                    onValueChange={(value) => setSelectedUserId(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableMembers.length > 0 ? (
                        assignableMembers.map((member) => (
                          <SelectItem key={member.userId} value={member.userId}>
                            {member.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none" disabled>
                          No members without a direct override
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2 md:w-[10rem] md:flex-none">
                  <p className="text-foreground text-sm font-medium">Access</p>
                  <Select
                    value={selectedAccess}
                    onValueChange={(value) =>
                      setSelectedAccess(value as PermissionAccess)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="none">No access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  className="w-full gap-2 md:w-auto md:flex-none"
                  disabled={!selectedUserId || isMutating}
                  onClick={() => {
                    if (!selectedUserId) {
                      return
                    }

                    setAccessMutation.mutate({
                      connectionId,
                      userId: selectedUserId,
                      path: normalizedPath,
                      access: selectedAccess,
                    })
                    setSelectedUserId('')
                  }}
                >
                  {setAccessMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Add override
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-sm border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[22%] whitespace-normal">
                      Member
                    </TableHead>
                    <TableHead className="w-[28%] whitespace-normal">
                      Inherited
                    </TableHead>
                    <TableHead className="w-[22%] whitespace-normal">
                      Explicit override
                    </TableHead>
                    <TableHead className="w-[16%] whitespace-normal">
                      Effective access
                    </TableHead>
                    <TableHead className="w-[12%] text-right whitespace-normal">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberRows.map((member) => {
                    const isTeamAdmin =
                      member.role === 'owner' || member.role === 'admin'

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="align-top whitespace-normal">
                          <div className="space-y-1">
                            <div className="text-foreground font-medium break-words">
                              {member.name}
                            </div>
                            <div className="text-muted-foreground text-xs break-all">
                              {member.email || formatRole(member.role)}
                            </div>
                            {member.email ? (
                              <div className="text-muted-foreground text-xs">
                                {formatRole(member.role)}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="space-y-2">
                            <AccessBadge access={member.inheritedAccess} />
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {member.inheritedSource}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          {isTeamAdmin ? (
                            <p className="text-muted-foreground text-sm">
                              Not needed for team admins.
                            </p>
                          ) : (
                            <Select
                              value={member.explicitAccess ?? '__inherit__'}
                              onValueChange={(value) => {
                                if (value === '__inherit__') {
                                  return
                                }

                                setAccessMutation.mutate({
                                  connectionId,
                                  userId: member.userId,
                                  path: normalizedPath,
                                  access: value as PermissionAccess,
                                })
                              }}
                              disabled={isMutating}
                            >
                              <SelectTrigger className="w-full min-w-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__inherit__">
                                  Inherit only
                                </SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="none">No access</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <AccessBadge access={member.effectiveAccess} />
                        </TableCell>
                        <TableCell className="text-right align-top whitespace-normal">
                          {member.explicitAccess !== null && !isTeamAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive ml-auto"
                              disabled={isMutating}
                              onClick={() => {
                                removeAccessMutation.mutate({
                                  connectionId,
                                  userId: member.userId,
                                  path: normalizedPath,
                                })
                              }}
                            >
                              <Trash2 className="size-4" />
                              Remove
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {isTeamAdmin ? 'Always editor' : 'Inherited only'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {removableUnknownEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="align-top whitespace-normal">
                        <div className="space-y-1">
                          <div className="text-foreground font-medium break-words">
                            {entry.name || entry.email || entry.userId}
                          </div>
                          <div className="text-muted-foreground text-xs break-all">
                            {entry.email || 'No longer in this team'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <span className="text-muted-foreground text-sm">
                          Not applicable
                        </span>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <AccessBadge access={parseAccess(entry.access)} />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <span className="text-muted-foreground text-sm">
                          No team membership
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-normal">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive ml-auto"
                          disabled={isMutating}
                          onClick={() => {
                            removeAccessMutation.mutate({
                              connectionId,
                              userId: entry.userId,
                              path: normalizedPath,
                            })
                          }}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
