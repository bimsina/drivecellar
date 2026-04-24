import type { FileEntry } from '#/lib/storage/types'

/** Max bytes to load into memory for text preview on the file detail page. */
export const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024

export type DownloadDisposition = 'attachment' | 'inline'

export type PreviewKind =
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'text'
  | 'unsupported'

type DownloadUrlOptions = {
  disposition?: DownloadDisposition
}

export function buildDownloadUrl(
  connectionId: string,
  filePath: string,
  options: DownloadUrlOptions = {},
) {
  const params = new URLSearchParams({
    connectionId,
    path: filePath,
  })
  if (options.disposition) {
    params.set('disposition', options.disposition)
  }
  return `/api/files/download?${params.toString()}`
}

export function buildInlinePreviewUrl(connectionId: string, filePath: string) {
  return buildDownloadUrl(connectionId, filePath, { disposition: 'inline' })
}

export function buildShareDownloadUrl(
  token: string,
  path: string,
  password?: string,
  options: DownloadUrlOptions = {},
) {
  const params = new URLSearchParams({
    token,
    path,
  })

  if (password) {
    params.set('password', password)
  }
  if (options.disposition) {
    params.set('disposition', options.disposition)
  }

  return `/api/share/download?${params.toString()}`
}

export function buildShareInlinePreviewUrl(
  token: string,
  path: string,
  password?: string,
) {
  return buildShareDownloadUrl(token, path, password, { disposition: 'inline' })
}

export function isImageEntry(entry: FileEntry) {
  return getPreviewKind(entry) === 'image'
}

export function isTextPreviewable(entry: FileEntry): boolean {
  if (entry.isDirectory) return false
  if (entry.size != null && entry.size > MAX_TEXT_PREVIEW_BYTES) return false
  const mime = entry.mimeType ?? ''
  if (mime.startsWith('text/')) return true
  if (
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript' ||
    mime === 'application/x-yaml' ||
    mime === 'application/x-ndjson'
  ) {
    return true
  }
  const ext = entry.name.includes('.')
    ? entry.name.split('.').pop()?.toLowerCase()
    : ''
  if (!ext) return false
  const textLike = new Set([
    'txt',
    'md',
    'markdown',
    'json',
    'jsonl',
    'xml',
    'csv',
    'ts',
    'tsx',
    'mts',
    'cts',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'css',
    'scss',
    'less',
    'html',
    'htm',
    'yaml',
    'yml',
    'sh',
    'bash',
    'zsh',
    'env',
    'log',
    'ini',
    'toml',
    'rs',
    'py',
    'go',
    'java',
    'c',
    'h',
    'cpp',
    'hpp',
    'cs',
    'vue',
    'svelte',
    'sql',
    'graphql',
    'gql',
    'mdx',
  ])
  return textLike.has(ext)
}

function extensionFor(entry: Pick<FileEntry, 'name'>) {
  return entry.name.includes('.')
    ? entry.name.split('.').pop()?.toLowerCase()
    : ''
}

export function getPreviewKind(entry: FileEntry): PreviewKind {
  if (entry.isDirectory) {
    return 'unsupported'
  }

  const mime = entry.mimeType?.toLowerCase() ?? ''
  const ext = extensionFor(entry)

  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (isTextPreviewable(entry)) return 'text'

  if (ext) {
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) {
      return 'image'
    }
    if (ext === 'pdf') return 'pdf'
    if (['mp4', 'webm', 'ogv', 'mov', 'm4v'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'].includes(ext)) {
      return 'audio'
    }
  }

  return 'unsupported'
}
