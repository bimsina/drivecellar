import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto'

/** Stored prefix so ciphertext is self-describing in JSON. */
export const CREDENTIAL_ENCRYPTION_PREFIX = 'enc:v1:' as const

const HKDF_SALT = Buffer.from('drivecellar.conn-creds.v1', 'utf8')
const HKDF_INFO = Buffer.from('aes-256-gcm', 'utf8')

/** Derives a 32-byte AES key from the server passphrase. */
export function deriveConnectionEncryptionKey(passphrase: string): Buffer {
  return Buffer.from(hkdfSync('sha256', passphrase, HKDF_SALT, HKDF_INFO, 32))
}

export function isEncryptedCredential(value: string): boolean {
  return value.startsWith(CREDENTIAL_ENCRYPTION_PREFIX)
}

export function encryptCredentialValue(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, ciphertext, tag])
  return `${CREDENTIAL_ENCRYPTION_PREFIX}${payload.toString('base64url')}`
}

export function decryptCredentialValue(enc: string, key: Buffer): string {
  if (!isEncryptedCredential(enc)) {
    throw new Error('Value is not an encrypted credential.')
  }
  const b64 = enc.slice(CREDENTIAL_ENCRYPTION_PREFIX.length)
  const raw = Buffer.from(b64, 'base64url')
  if (raw.length < 12 + 16) {
    throw new Error('Invalid encrypted credential payload.')
  }
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(raw.length - 16)
  const ciphertext = raw.subarray(12, raw.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}
