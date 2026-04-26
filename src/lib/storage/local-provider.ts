import { createReadStream, createWriteStream, type ReadStream } from 'node:fs'
import {
  mkdir as mkdirAsync,
  realpath,
  readdir,
  rename as renameAsync,
  rm,
  stat,
} from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'

import mime from 'mime'

import type { LocalConfig } from '#/lib/connections.ts'

import type {
  FileEntry,
  ListResult,
  StorageProvider,
  WriteFileOptions,
} from './types.ts'
import { StorageProviderError, toStorageProviderError } from './errors.ts'
import { PathError } from './path-utils.ts'

function toFsPath(basePath: string, normalizedPath: string): string {
  const rel = normalizedPath === '/' ? '' : normalizedPath.replace(/^\//, '')
  const segments = rel.split('/').filter(Boolean)
  return path.join(basePath, ...segments)
}

function assertWithinBase(basePath: string, fsPath: string) {
  const resolved = path.resolve(fsPath)
  const baseResolved = path.resolve(basePath)
  const prefix = baseResolved.endsWith(path.sep)
    ? baseResolved
    : baseResolved + path.sep
  if (resolved !== baseResolved && !resolved.startsWith(prefix)) {
    throw new PathError('Path escapes the connection root.')
  }
}

function isWithinBase(basePath: string, fsPath: string) {
  const relative = path.relative(basePath, fsPath)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

function hasFsErrorCode(error: unknown, code: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    Reflect.get(error, 'code') === code
  )
}

function getMimeType(fileName: string): string | null {
  return mime.getType(fileName)
}

function toFileEntry(
  name: string,
  entryPath: string,
  st: Awaited<ReturnType<typeof stat>>,
): FileEntry {
  const isDirectory = st.isDirectory()
  return {
    name,
    path: entryPath,
    isDirectory,
    size: isDirectory ? null : Number(st.size),
    mimeType: isDirectory ? null : getMimeType(name),
    lastModified: st.mtime,
  }
}

export function createLocalProvider(config: LocalConfig): StorageProvider {
  const basePath = path.resolve(config.basePath)
  let baseRealPathPromise: Promise<string> | null = null

  async function pathToFs(normalizedPath: string) {
    const fsPath = toFsPath(basePath, normalizedPath)
    assertWithinBase(basePath, fsPath)
    return fsPath
  }

  async function getBaseRealPath() {
    baseRealPathPromise ??= realpath(basePath).catch((error: unknown) => {
      baseRealPathPromise = null
      throw toStorageProviderError(error)
    })
    return baseRealPathPromise
  }

  async function assertRealPathWithinBase(fsPath: string) {
    const [baseRealPath, targetRealPath] = await Promise.all([
      getBaseRealPath(),
      realpath(fsPath),
    ])

    if (!isWithinBase(baseRealPath, targetRealPath)) {
      throw new StorageProviderError('path_escape')
    }

    return targetRealPath
  }

  async function existingPathToFs(normalizedPath: string) {
    const fsPath = await pathToFs(normalizedPath)
    await assertRealPathWithinBase(fsPath)
    return fsPath
  }

  async function assertNearestExistingParentWithinBase(fsPath: string) {
    const baseRealPath = await getBaseRealPath()
    let current = fsPath

    for (;;) {
      try {
        const currentRealPath = await realpath(current)
        if (!isWithinBase(baseRealPath, currentRealPath)) {
          throw new StorageProviderError('path_escape')
        }
        return
      } catch (error) {
        if (error instanceof StorageProviderError) {
          throw error
        }
        if (hasFsErrorCode(error, 'ENOENT')) {
          const parent = path.dirname(current)
          if (parent === current) {
            throw toStorageProviderError(error)
          }
          current = parent
          continue
        }
        throw toStorageProviderError(error)
      }
    }
  }

  async function prepareWritablePath(normalizedPath: string) {
    const fsPath = await pathToFs(normalizedPath)
    try {
      await assertRealPathWithinBase(fsPath)
    } catch (error) {
      if (hasFsErrorCode(error, 'ENOENT')) {
        await assertNearestExistingParentWithinBase(path.dirname(fsPath))
        return fsPath
      }
      if (error instanceof StorageProviderError && error.code === 'not_found') {
        await assertNearestExistingParentWithinBase(path.dirname(fsPath))
        return fsPath
      }
      throw error
    }
    return fsPath
  }

  async function listDirectory(
    dirPath: string,
    onEntry?: (entry: FileEntry) => Promise<void>,
  ) {
    const dirFs = await existingPathToFs(dirPath)
    const st = await stat(dirFs).catch(() => null)
    if (!st || !st.isDirectory()) {
      throw new StorageProviderError('not_a_directory')
    }

    const names = await readdir(dirFs)
    const entries: FileEntry[] = []

    for (const name of names) {
      const childFs = path.join(dirFs, name)
      const childPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`

      try {
        await assertRealPathWithinBase(childFs)
        const childStat = await stat(childFs)
        const entry = toFileEntry(name, childPath, childStat)
        entries.push(entry)
        await onEntry?.(entry)
      } catch (error) {
        if (
          error instanceof StorageProviderError &&
          error.code === 'path_escape'
        ) {
          continue
        }
        if (hasFsErrorCode(error, 'ENOENT')) {
          continue
        }
        throw error
      }
    }

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    return { path: dirPath, entries }
  }

  return {
    async list(dirPath: string): Promise<ListResult> {
      try {
        return await listDirectory(dirPath)
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async stat(entryPath: string): Promise<FileEntry> {
      try {
        const fsPath =
          entryPath === '/'
            ? await existingPathToFs('/')
            : await existingPathToFs(entryPath)
        const st = await stat(fsPath)
        const name =
          entryPath === '/' ? path.basename(basePath) : path.basename(fsPath)
        return toFileEntry(name, entryPath, st)
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async mkdir(dirPath: string): Promise<void> {
      try {
        const fsPath = await prepareWritablePath(dirPath)
        await mkdirAsync(fsPath, { recursive: true })
        await assertRealPathWithinBase(fsPath)
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async delete(entryPath: string): Promise<void> {
      try {
        const fsPath = await existingPathToFs(entryPath)
        const st = await stat(fsPath)
        await rm(fsPath, { recursive: st.isDirectory() })
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      try {
        const from = await existingPathToFs(oldPath)
        const to = await prepareWritablePath(newPath)
        await mkdirAsync(path.dirname(to), { recursive: true })
        await assertRealPathWithinBase(path.dirname(to))
        await renameAsync(from, to)
        await assertRealPathWithinBase(to)
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async getReadStream(
      entryPath: string,
      options,
    ): Promise<ReadableStream<Uint8Array>> {
      try {
        const fsPath = await existingPathToFs(entryPath)
        const st = await stat(fsPath)
        if (st.isDirectory()) {
          throw new StorageProviderError(
            'not_a_directory',
            'Cannot read a directory as a file.',
          )
        }
        const nodeStream: ReadStream = createReadStream(fsPath, {
          start: options?.range?.start,
          end: options?.range?.end,
        })
        return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async getFileMetadata(entryPath: string) {
      try {
        const fsPath = await existingPathToFs(entryPath)
        const st = await stat(fsPath)
        if (st.isDirectory()) {
          throw new StorageProviderError(
            'not_a_directory',
            'Path is a directory.',
          )
        }
        const fileName = path.basename(fsPath)
        return {
          size: st.size,
          mimeType: getMimeType(fileName),
          fileName,
        }
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async writeFile(
      entryPath: string,
      stream: ReadableStream<Uint8Array>,
      _size?: number,
      options?: WriteFileOptions,
    ): Promise<FileEntry> {
      try {
        const fsPath = await prepareWritablePath(entryPath)
        await mkdirAsync(path.dirname(fsPath), { recursive: true })
        await assertRealPathWithinBase(path.dirname(fsPath))
        const nodeReadable = Readable.fromWeb(stream as NodeWebReadableStream)
        const writeStream = createWriteStream(fsPath, {
          flags: options?.overwrite === false ? 'wx' : 'w',
        })
        await pipeline(nodeReadable, writeStream)
        await assertRealPathWithinBase(fsPath)
        const st = await stat(fsPath)
        const name = path.basename(fsPath)
        return toFileEntry(name, entryPath, st)
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },

    async walk(signal, onEntry): Promise<void> {
      async function walkDirectory(dirPath: string) {
        signal.throwIfAborted()
        const result = await listDirectory(dirPath)

        for (const entry of result.entries) {
          signal.throwIfAborted()
          await onEntry(entry)
          if (entry.isDirectory) {
            await walkDirectory(entry.path)
          }
        }
      }

      try {
        await getBaseRealPath()
        await walkDirectory('/')
      } catch (error) {
        throw toStorageProviderError(error)
      }
    },
  }
}

export async function ensureLocalBasePath(basePath: string): Promise<void> {
  try {
    const resolvedBasePath = path.resolve(basePath)
    await mkdirAsync(resolvedBasePath, { recursive: true })
    const st = await stat(resolvedBasePath)
    if (!st.isDirectory()) {
      throw new StorageProviderError('not_a_directory')
    }
  } catch (error) {
    throw toStorageProviderError(error)
  }
}
