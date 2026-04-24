import { createFileRoute } from '@tanstack/react-router'

import { resolveSharedLinkAccess } from '#/lib/shared-links.ts'
import { normalizePath, PathError } from '#/lib/storage/path-utils.ts'
import { parseRangeHeader } from '#/lib/storage/range-request.ts'

export const Route = createFileRoute('/api/share/download')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const token = url.searchParams.get('token')
        const password = url.searchParams.get('password') ?? undefined
        const pathParam = url.searchParams.get('path') ?? '/'
        const disposition =
          url.searchParams.get('disposition') === 'inline'
            ? 'inline'
            : 'attachment'

        if (!token) {
          throw new Response('Missing token.', { status: 400 })
        }

        let path: string
        try {
          path = normalizePath(pathParam)
        } catch (error) {
          if (error instanceof PathError) {
            throw new Response(error.message, { status: 400 })
          }
          throw error
        }

        let resolved: Awaited<ReturnType<typeof resolveSharedLinkAccess>>
        try {
          resolved = await resolveSharedLinkAccess({
            token,
            password,
            relativePath: path,
          })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Shared link unavailable.'
          const status =
            message === 'Password required.' || message === 'Invalid password.'
              ? 401
              : 404

          throw new Response(message, { status })
        }

        let meta: {
          size: number | null
          mimeType: string | null
          fileName: string
        }
        try {
          meta = await resolved.provider.getFileMetadata(resolved.absolutePath)
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

        const stream = await resolved.provider.getReadStream(
          resolved.absolutePath,
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
