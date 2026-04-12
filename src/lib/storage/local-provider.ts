import { createReadStream, createWriteStream, type ReadStream } from 'node:fs'
import {
  mkdir as mkdirAsync,
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

import type { FileEntry, ListResult, StorageProvider } from './types.ts'
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

function getMimeType(fileName: string): string | null {
  return mime.getType(fileName)
}

export function createLocalProvider(config: LocalConfig): StorageProvider {
  const basePath = path.resolve(config.basePath)

  async function pathToFs(normalizedPath: string) {
    const fsPath = toFsPath(basePath, normalizedPath)
    assertWithinBase(basePath, fsPath)
    return fsPath
  }

  return {
    async list(dirPath: string): Promise<ListResult> {
      const dirFs = await pathToFs(dirPath)
      const st = await stat(dirFs).catch(() => null)
      if (!st || !st.isDirectory()) {
        throw new Error('Not a directory.')
      }

      const names = await readdir(dirFs)
      const entries: FileEntry[] = []

      for (const name of names) {
        const childFs = path.join(dirFs, name)
        const childStat = await stat(childFs)
        const childPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`
        const isDirectory = childStat.isDirectory()
        entries.push({
          name,
          path: childPath,
          isDirectory,
          size: isDirectory ? null : childStat.size,
          mimeType: isDirectory ? null : getMimeType(name),
          lastModified: childStat.mtime,
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
        const st = await stat(basePath)
        return {
          name: path.basename(basePath),
          path: '/',
          isDirectory: true,
          size: null,
          mimeType: null,
          lastModified: st.mtime,
        }
      }

      const fsPath = await pathToFs(entryPath)
      const st = await stat(fsPath)
      const name = path.basename(fsPath)
      const isDirectory = st.isDirectory()
      return {
        name,
        path: entryPath,
        isDirectory,
        size: isDirectory ? null : st.size,
        mimeType: isDirectory ? null : getMimeType(name),
        lastModified: st.mtime,
      }
    },

    async mkdir(dirPath: string): Promise<void> {
      const fsPath = await pathToFs(dirPath)
      await mkdirAsync(fsPath, { recursive: true })
    },

    async delete(entryPath: string): Promise<void> {
      const fsPath = await pathToFs(entryPath)
      const st = await stat(fsPath)
      await rm(fsPath, { recursive: st.isDirectory() })
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      const from = await pathToFs(oldPath)
      const to = await pathToFs(newPath)
      await renameAsync(from, to)
    },

    async getReadStream(
      entryPath: string,
    ): Promise<ReadableStream<Uint8Array>> {
      const fsPath = await pathToFs(entryPath)
      const st = await stat(fsPath)
      if (st.isDirectory()) {
        throw new Error('Cannot read a directory as a file.')
      }
      const nodeStream: ReadStream = createReadStream(fsPath)
      return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
    },

    async getFileMetadata(entryPath: string) {
      const fsPath = await pathToFs(entryPath)
      const st = await stat(fsPath)
      if (st.isDirectory()) {
        throw new Error('Path is a directory.')
      }
      const fileName = path.basename(fsPath)
      return {
        size: st.size,
        mimeType: getMimeType(fileName),
        fileName,
      }
    },

    async writeFile(
      entryPath: string,
      stream: ReadableStream<Uint8Array>,
      _size?: number,
    ): Promise<FileEntry> {
      const fsPath = await pathToFs(entryPath)
      await mkdirAsync(path.dirname(fsPath), { recursive: true })
      const nodeReadable = Readable.fromWeb(stream as NodeWebReadableStream)
      const writeStream = createWriteStream(fsPath)
      await pipeline(nodeReadable, writeStream)
      const st = await stat(fsPath)
      const name = path.basename(fsPath)
      return {
        name,
        path: entryPath,
        isDirectory: false,
        size: st.size,
        mimeType: getMimeType(name),
        lastModified: st.mtime,
      }
    },
  }
}
