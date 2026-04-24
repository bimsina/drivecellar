export type FileEntry = {
  name: string
  path: string
  isDirectory: boolean
  size: number | null
  mimeType: string | null
  lastModified: Date | null
}

export type ListResult = {
  path: string
  entries: FileEntry[]
}

export type ReadRange = {
  start: number
  end?: number
}

export type ReadStreamOptions = {
  range?: ReadRange
}

export interface StorageProvider {
  list: (path: string) => Promise<ListResult>
  stat: (path: string) => Promise<FileEntry>
  mkdir: (path: string) => Promise<void>
  delete: (path: string) => Promise<void>
  rename: (oldPath: string, newPath: string) => Promise<void>
  getReadStream: (
    path: string,
    options?: ReadStreamOptions,
  ) => Promise<ReadableStream<Uint8Array>>
  getFileMetadata: (path: string) => Promise<{
    size: number | null
    mimeType: string | null
    fileName: string
  }>
  writeFile: (
    path: string,
    stream: ReadableStream<Uint8Array>,
    size?: number,
  ) => Promise<FileEntry>
}
