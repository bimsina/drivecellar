import { auth } from '#/lib/auth'
import {
  canRead,
  canWrite,
  getOrganizationRole,
  isOrganizationAdminRole,
  resolvePermission,
} from '#/lib/permissions'

/**
 * Validates session and active organization for raw HTTP handlers.
 * Throws `Response` with an HTTP error status on failure.
 */
export async function verifyFileAccess(request: Request): Promise<{
  userId: string
  organizationId: string
  organizationRole: 'owner' | 'admin' | 'member'
}> {
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  })

  if (!sessionData?.session) {
    throw new Response('Unauthorized', { status: 401 })
  }

  const organizationId = sessionData.session.activeOrganizationId

  if (!organizationId) {
    throw new Response('Select an active team.', { status: 400 })
  }

  const organizationRole = await getOrganizationRole(
    sessionData.user.id,
    organizationId,
  )

  if (!organizationRole) {
    throw new Response('Forbidden', { status: 403 })
  }

  return {
    userId: sessionData.user.id,
    organizationId,
    organizationRole,
  }
}

export async function verifyFilePermission(args: {
  request: Request
  connectionId: string
  path: string
  action: 'read' | 'write'
}) {
  const session = await verifyFileAccess(args.request)

  if (isOrganizationAdminRole(session.organizationRole)) {
    return session
  }

  const access = await resolvePermission(
    session.userId,
    session.organizationId,
    args.connectionId,
    args.path,
  )

  const allowed = args.action === 'read' ? canRead(access) : canWrite(access)

  if (!allowed) {
    throw new Response('Forbidden', { status: 403 })
  }

  return session
}
