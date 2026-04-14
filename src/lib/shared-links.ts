import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { sharedLinks } from '#/db/schema/index.ts'
import { resolveProvider } from '#/lib/storage/index.ts'
import { normalizePath } from '#/lib/storage/path-utils.ts'

import { isDescendantOrSelf } from './permissions.ts'

const SCRYPT_KEYLEN = 64

function toHex(buffer: Uint8Array) {
  return Buffer.from(buffer).toString('hex')
}

function fromHex(value: string) {
  return Buffer.from(value, 'hex')
}

export function generateShareToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSharedLinkPassword(password: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `${toHex(salt)}:${toHex(hash)}`
}

export function verifySharedLinkPassword(password: string, storedHash: string) {
  const [saltHex, hashHex] = storedHash.split(':')

  if (!saltHex || !hashHex) {
    return false
  }

  const expected = fromHex(hashHex)
  const actual = scryptSync(password, fromHex(saltHex), expected.length)
  return timingSafeEqual(actual, expected)
}

function joinSharedPath(rootPath: string, relativePath: string) {
  const normalizedRoot = normalizePath(rootPath)
  const normalizedRelative = normalizePath(relativePath)

  if (normalizedRelative === '/') {
    return normalizedRoot
  }

  return normalizePath(
    normalizedRoot === '/'
      ? normalizedRelative
      : `${normalizedRoot}${normalizedRelative}`,
  )
}

export function toShareRelativePath(rootPath: string, absolutePath: string) {
  const normalizedRoot = normalizePath(rootPath)
  const normalizedAbsolute = normalizePath(absolutePath)

  if (normalizedRoot === normalizedAbsolute) {
    return '/'
  }

  if (normalizedRoot === '/') {
    return normalizedAbsolute
  }

  return normalizePath(normalizedAbsolute.slice(normalizedRoot.length))
}

export async function getSharedLinkByToken(token: string) {
  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.token, token))

  return link ?? null
}

export async function resolveSharedLinkAccess(args: {
  token: string
  password?: string
  relativePath?: string
}) {
  const sharedLink = await getSharedLinkByToken(args.token)

  if (!sharedLink || !sharedLink.enabled) {
    throw new Error('Shared link not found.')
  }

  if (sharedLink.expiresAt && sharedLink.expiresAt.getTime() <= Date.now()) {
    throw new Error('Shared link has expired.')
  }

  if (sharedLink.passwordHash) {
    if (!args.password?.trim()) {
      throw new Error('Password required.')
    }

    if (!verifySharedLinkPassword(args.password, sharedLink.passwordHash)) {
      throw new Error('Invalid password.')
    }
  }

  const requestedRelativePath = normalizePath(args.relativePath ?? '/')
  const absolutePath = sharedLink.isDirectory
    ? joinSharedPath(sharedLink.path, requestedRelativePath)
    : sharedLink.path

  if (!isDescendantOrSelf(absolutePath, sharedLink.path)) {
    throw new Error('Invalid shared path.')
  }

  if (!sharedLink.isDirectory && requestedRelativePath !== '/') {
    throw new Error('Invalid shared path.')
  }

  const provider = await resolveProvider(
    sharedLink.connectionId,
    sharedLink.organizationId,
  )

  return {
    sharedLink,
    provider,
    absolutePath,
    relativePath: toShareRelativePath(sharedLink.path, absolutePath),
  }
}

export async function getSharedLinkById(id: string, organizationId: string) {
  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(
      and(
        eq(sharedLinks.id, id),
        eq(sharedLinks.organizationId, organizationId),
      ),
    )

  return link ?? null
}
