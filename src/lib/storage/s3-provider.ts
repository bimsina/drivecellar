import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'

import mime from 'mime'

import type { S3Config } from '#/lib/connections.ts'

import type { FileEntry, ListResult, StorageProvider } from './types.ts'

function normalizeStorePrefix(prefix: string | undefined): string {
  if (!prefix?.trim()) return ''
  return prefix.trim().replace(/^\//, '').replace(/\/$/, '')
}

function shouldForcePathStyle(config: S3Config): boolean {
  if (config.pathStyle) {
    return true
  }

  try {
    const { hostname } = new URL(config.endpoint)

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost') ||
      hostname.includes('minio')
    )
  } catch {
    return config.pathStyle
  }
}

function hasTransformToWebStream(
  value: unknown,
): value is { transformToWebStream: () => ReadableStream<Uint8Array> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'transformToWebStream') === 'function'
  )
}

function hasWebStreamBody(
  value: unknown,
): value is { stream: () => ReadableStream<Uint8Array> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'stream') === 'function'
  )
}

function isNodeReadable(value: unknown): value is Readable {
  return (
    typeof value === 'object' && value !== null && value instanceof Readable
  )
}

function isAsyncIterableBody(
  value: unknown,
): value is AsyncIterable<Uint8Array> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, Symbol.asyncIterator) === 'function'
  )
}

function objectKey(storePrefix: string, absolutePath: string): string {
  const rel = absolutePath === '/' ? '' : absolutePath.replace(/^\//, '')
  if (!storePrefix) return rel
  if (!rel) return storePrefix
  return `${storePrefix}/${rel}`
}

function listPrefix(storePrefix: string, absolutePath: string): string {
  const key = objectKey(storePrefix, absolutePath)
  return key === '' ? '' : `${key}/`
}

function getMimeType(fileName: string): string | null {
  return mime.getType(fileName)
}

function copySource(bucket: string, key: string): string {
  return `${bucket}/${encodeURIComponent(key)}`
}

export function createS3Provider(config: S3Config): StorageProvider {
  const client = new S3Client({
    region: config.region?.trim() || 'us-east-1',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: shouldForcePathStyle(config),
  })

  const bucket = config.bucket
  const storePrefix = normalizeStorePrefix(config.prefix)

  async function deletePrefixRecursive(prefix: string): Promise<void> {
    let continuationToken: string | undefined
    do {
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )
      const keys = (list.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k))
      if (keys.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: keys.map((Key) => ({ Key })),
              Quiet: true,
            },
          }),
        )
      }
      continuationToken = list.IsTruncated
        ? list.NextContinuationToken
        : undefined
    } while (continuationToken)
  }

  return {
    async list(dirPath: string): Promise<ListResult> {
      const lp = listPrefix(storePrefix, dirPath)
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: lp,
          Delimiter: '/',
          MaxKeys: 1000,
        }),
      )

      const entries: FileEntry[] = []
      const seen = new Set<string>()

      for (const cp of response.CommonPrefixes ?? []) {
        const prefix = cp.Prefix
        if (!prefix) continue
        const rel = prefix.slice(lp.length).replace(/\/$/, '')
        const name = rel.split('/')[0]
        if (!name || seen.has(name)) continue
        seen.add(name)
        const absPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`
        entries.push({
          name,
          path: absPath,
          isDirectory: true,
          size: null,
          mimeType: null,
          lastModified: null,
        })
      }

      for (const obj of response.Contents ?? []) {
        const key = obj.Key
        if (!key) continue
        if (key === lp) continue
        const rest = key.slice(lp.length)
        if (rest.includes('/')) continue

        if (rest.endsWith('/')) {
          const name = rest.slice(0, -1)
          if (!name || seen.has(name)) continue
          seen.add(name)
          const absPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`
          entries.push({
            name,
            path: absPath,
            isDirectory: true,
            size: null,
            mimeType: null,
            lastModified: obj.LastModified ?? null,
          })
          continue
        }

        const name = rest
        if (!name || seen.has(name)) continue
        seen.add(name)
        const absPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`
        entries.push({
          name,
          path: absPath,
          isDirectory: false,
          size: obj.Size ?? null,
          mimeType: getMimeType(name),
          lastModified: obj.LastModified ?? null,
        })
      }

      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return { path: dirPath, entries }
    },

    async stat(entryPath: string): Promise<FileEntry> {
      if (entryPath === '/') {
        return {
          name: '',
          path: '/',
          isDirectory: true,
          size: null,
          mimeType: null,
          lastModified: null,
        }
      }

      const key = objectKey(storePrefix, entryPath)
      const dirKey = `${key}/`

      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        )
        const name = entryPath.split('/').pop() || key
        return {
          name,
          path: entryPath,
          isDirectory: false,
          size: head.ContentLength ?? null,
          mimeType: head.ContentType ?? getMimeType(name),
          lastModified: head.LastModified ?? null,
        }
      } catch {
        // not a file — try directory marker or implicit directory
      }

      try {
        await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: dirKey }),
        )
        const name = entryPath.split('/').pop() || ''
        return {
          name,
          path: entryPath,
          isDirectory: true,
          size: null,
          mimeType: null,
          lastModified: null,
        }
      } catch {
        // fall through
      }

      const childPrefix = listPrefix(storePrefix, entryPath)
      const probe = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: childPrefix,
          MaxKeys: 1,
        }),
      )
      if ((probe.KeyCount ?? 0) > 0 || (probe.Contents?.length ?? 0) > 0) {
        const name = entryPath.split('/').pop() || ''
        return {
          name,
          path: entryPath,
          isDirectory: true,
          size: null,
          mimeType: null,
          lastModified: null,
        }
      }

      throw new Error('Path not found.')
    },

    async mkdir(dirPath: string): Promise<void> {
      const key = `${objectKey(storePrefix, dirPath)}/`
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.alloc(0),
        }),
      )
    },

    async delete(entryPath: string): Promise<void> {
      const key = objectKey(storePrefix, entryPath)

      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        return
      } catch {
        // not a plain file
      }

      const asDirPrefix = `${key}/`
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: asDirPrefix,
          MaxKeys: 1,
        }),
      )
      if ((list.KeyCount ?? 0) === 0 && !list.Contents?.length) {
        try {
          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: `${key}/` }),
          )
        } catch {
          throw new Error('Path not found.')
        }
        return
      }

      await deletePrefixRecursive(asDirPrefix)
      await client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: `${key}/` }))
        .catch(() => undefined)
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      const oldKey = objectKey(storePrefix, oldPath)
      const newKey = objectKey(storePrefix, newPath)

      let isDir = false
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: `${oldKey}/` }),
        )
        isDir = true
      } catch {
        try {
          await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: oldKey }),
          )
        } catch {
          const childPrefix = listPrefix(storePrefix, oldPath)
          const probe = await client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              Prefix: childPrefix,
              MaxKeys: 1,
            }),
          )
          if ((probe.KeyCount ?? 0) > 0 || (probe.Contents?.length ?? 0) > 0) {
            isDir = true
          } else {
            throw new Error('Source path not found.')
          }
        }
      }

      if (!isDir) {
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: newKey,
            CopySource: copySource(bucket, oldKey),
          }),
        )
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }),
        )
        return
      }

      const oldPrefix = `${oldKey}/`
      const newPrefix = `${newKey}/`

      let continuationToken: string | undefined
      do {
        const list = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: oldPrefix,
            ContinuationToken: continuationToken,
          }),
        )
        for (const obj of list.Contents ?? []) {
          const k = obj.Key
          if (!k) continue
          const suffix = k.slice(oldPrefix.length)
          const destKey = `${newPrefix}${suffix}`
          await client.send(
            new CopyObjectCommand({
              Bucket: bucket,
              Key: destKey,
              CopySource: copySource(bucket, k),
            }),
          )
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }))
        }
        continuationToken = list.IsTruncated
          ? list.NextContinuationToken
          : undefined
      } while (continuationToken)

      await client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: `${oldKey}/` }))
        .catch(() => undefined)
    },

    async getReadStream(
      entryPath: string,
      options,
    ): Promise<ReadableStream<Uint8Array>> {
      const key = objectKey(storePrefix, entryPath)
      const range = options?.range
        ? `bytes=${options.range.start}-${options.range.end ?? ''}`
        : undefined
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }),
      )
      const body: unknown = response.Body
      if (!body) {
        throw new Error('Empty response body.')
      }
      if (hasTransformToWebStream(body)) {
        return body.transformToWebStream()
      }
      if (hasWebStreamBody(body)) {
        return body.stream()
      }
      if (isNodeReadable(body)) {
        return Readable.toWeb(body) as ReadableStream<Uint8Array>
      }
      if (isAsyncIterableBody(body)) {
        return Readable.toWeb(Readable.from(body)) as ReadableStream<Uint8Array>
      }
      throw new Error('Unsupported S3 body type.')
    },

    async getFileMetadata(entryPath: string) {
      const key = objectKey(storePrefix, entryPath)
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      )
      const fileName = entryPath.split('/').pop() || key
      return {
        size: head.ContentLength ?? null,
        mimeType: head.ContentType ?? getMimeType(fileName),
        fileName,
      }
    },

    async writeFile(
      entryPath: string,
      stream: ReadableStream<Uint8Array>,
      size?: number,
    ): Promise<FileEntry> {
      const key = objectKey(storePrefix, entryPath)
      const fileName = entryPath.split('/').pop() || key
      const contentType = getMimeType(fileName) ?? 'application/octet-stream'
      const nodeReadable = Readable.fromWeb(stream as NodeWebReadableStream)

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: nodeReadable,
          ContentType: contentType,
          ...(typeof size === 'number' ? { ContentLength: size } : {}),
        }),
      )

      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      )

      return {
        name: fileName,
        path: entryPath,
        isDirectory: false,
        size: head.ContentLength ?? null,
        mimeType: head.ContentType ?? getMimeType(fileName),
        lastModified: head.LastModified ?? new Date(),
      }
    },
  }
}
