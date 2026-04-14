import { createFileRoute } from '@tanstack/react-router'

import {
  verifyFileAccess,
  verifyFilePermission,
} from '#/lib/storage/auth-guard.ts'
import { indexInsertEntry } from '#/lib/indexing/index.ts'
import { resolveProvider } from '#/lib/storage/index.ts'
import { PathError } from '#/lib/storage/path-utils.ts'
import {
  buildRequestedUploadPath,
  resolveUploadPathConflict,
  type UploadConflictMode,
} from '#/lib/storage/upload-utils.ts'

function serializeEntryDates<T extends { lastModified: Date | null }>(
  entry: T,
) {
  return {
    ...entry,
    lastModified: entry.lastModified?.toISOString() ?? null,
  }
}

export const Route = createFileRoute('/api/files/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { organizationId } = await verifyFileAccess(request)
        const formData = await request.formData()
        const file = formData.get('file')
        const connectionId = formData.get('connectionId')
        const pathField = formData.get('path')
        const relativePathField = formData.get('relativePath')
        const conflictModeField = formData.get('conflictMode')

        if (!(file instanceof File)) {
          throw new Response('Expected a file field.', { status: 400 })
        }

        if (typeof connectionId !== 'string' || !connectionId.trim()) {
          throw new Response('Missing connectionId.', { status: 400 })
        }

        const pathRaw = typeof pathField === 'string' ? pathField : '/'
        const relativePath =
          typeof relativePathField === 'string' ? relativePathField : null
        const conflictMode: UploadConflictMode =
          conflictModeField === 'rename' || conflictModeField == null
            ? 'rename'
            : (() => {
                throw new Response('Unsupported conflictMode.', {
                  status: 400,
                })
              })()

        let requestedPath: string
        try {
          requestedPath = buildRequestedUploadPath(
            pathRaw,
            relativePath,
            file.name,
          )
        } catch (e) {
          if (e instanceof PathError) {
            throw new Response(e.message, { status: 400 })
          }
          throw e
        }

        const normalizedConnectionId = connectionId.trim()

        await verifyFilePermission({
          request,
          connectionId: normalizedConnectionId,
          path: requestedPath,
          action: 'write',
        })

        const provider = await resolveProvider(
          normalizedConnectionId,
          organizationId,
        )
        const { resolvedPath, conflictResolution } =
          await resolveUploadPathConflict(provider, requestedPath, conflictMode)

        const entry = await provider.writeFile(
          resolvedPath,
          file.stream(),
          file.size,
        )
        await indexInsertEntry(normalizedConnectionId, entry)

        return Response.json({
          entry: serializeEntryDates(entry),
          requestedPath,
          resolvedPath,
          conflictResolution,
        })
      },
    },
  },
})
