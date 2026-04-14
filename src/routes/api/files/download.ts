import { createFileRoute } from '@tanstack/react-router'

import { verifyFilePermission } from '#/lib/storage/auth-guard.ts'
import { resolveProvider } from '#/lib/storage/index.ts'
import { normalizePath, PathError } from '#/lib/storage/path-utils.ts'

export const Route = createFileRoute('/api/files/download')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const connectionId = url.searchParams.get('connectionId')
        const pathParam = url.searchParams.get('path') ?? '/'

        if (!connectionId) {
          throw new Response('Missing connectionId.', { status: 400 })
        }

        let path: string
        try {
          path = normalizePath(pathParam)
        } catch (e) {
          if (e instanceof PathError) {
            throw new Response(e.message, { status: 400 })
          }
          throw e
        }

        const { organizationId } = await verifyFilePermission({
          request,
          connectionId,
          path,
          action: 'read',
        })

        const provider = await resolveProvider(connectionId, organizationId)

        let meta: {
          size: number | null
          mimeType: string | null
          fileName: string
        }
        try {
          meta = await provider.getFileMetadata(path)
        } catch {
          throw new Response('File not found.', { status: 404 })
        }

        const stream = await provider.getReadStream(path)

        const headers = new Headers()
        headers.set('Content-Type', meta.mimeType ?? 'application/octet-stream')
        headers.set(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
        )
        if (meta.size !== null) {
          headers.set('Content-Length', String(meta.size))
        }

        return new Response(stream, { headers })
      },
    },
  },
})
