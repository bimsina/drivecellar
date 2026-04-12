import { auth } from '#/lib/auth'

/**
 * Validates session and active organization for raw HTTP handlers.
 * Throws `Response` with an HTTP error status on failure.
 */
export async function verifyFileAccess(
  request: Request,
): Promise<{ userId: string; organizationId: string }> {
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  })

  if (!sessionData?.session) {
    throw new Response('Unauthorized', { status: 401 })
  }

  const organizationId = sessionData.session.activeOrganizationId

  if (!organizationId) {
    throw new Response('Select an active organization.', { status: 400 })
  }

  return {
    userId: sessionData.user.id,
    organizationId,
  }
}
