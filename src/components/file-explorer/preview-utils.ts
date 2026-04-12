import type { FileEntry } from '#/lib/storage/types'

/** Max bytes to load into memory for text preview in the file detail dialog. */
export const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024

export function buildDownloadUrl(connectionId: string, filePath: string) {
  const params = new URLSearchParams({
    connectionId,
    path: filePath,
  })
  return `/api/files/download?${params.toString()}`
}

export function isImageEntry(entry: FileEntry) {
  if (entry.mimeType?.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)
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
