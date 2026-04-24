import { createFileRoute } from '@tanstack/react-router'

import { verifyFilePermission } from '#/lib/storage/auth-guard.ts'
import { resolveProvider } from '#/lib/storage/index.ts'
import { normalizePath, PathError } from '#/lib/storage/path-utils.ts'
import { parseRangeHeader } from '#/lib/storage/range-request.ts'

export const Route = createFileRoute('/api/files/download')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const connectionId = url.searchParams.get('connectionId')
        const pathParam = url.searchParams.get('path') ?? '/'
        const disposition =
          url.searchParams.get('disposition') === 'inline'
            ? 'inline'
            : 'attachment'

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

        const range = parseRangeHeader(request.headers.get('Range'), meta.size)

        if (range.status === 'unsatisfiable') {
          throw new Response('Range not satisfiable.', {
            status: 416,
            headers: {
              'Content-Range': range.contentRange,
            },
          })
        }

        const stream = await provider.getReadStream(
          path,
          range.status === 'partial' ? { range: range.range } : undefined,
        )

        const headers = new Headers()
        headers.set('Content-Type', meta.mimeType ?? 'application/octet-stream')
        headers.set('Accept-Ranges', 'bytes')
        headers.set(
          'Content-Disposition',
          `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
        )

        if (range.status === 'partial') {
          headers.set('Content-Range', range.contentRange)
          headers.set('Content-Length', String(range.contentLength))
        } else if (meta.size !== null) {
          headers.set('Content-Length', String(meta.size))
        }

        return new Response(stream, {
          status: range.status === 'partial' ? 206 : 200,
          headers,
        })
      },
    },
  },
})
