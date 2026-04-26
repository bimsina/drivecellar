export type StorageErrorCode =
  | 'already_exists'
  | 'not_found'
  | 'not_a_directory'
  | 'permission_denied'
  | 'path_escape'
  | 'unknown'

const defaultMessages: Record<StorageErrorCode, string> = {
  already_exists: 'Path already exists.',
  not_found: 'Path not found.',
  not_a_directory: 'Not a directory.',
  permission_denied: 'Permission denied.',
  path_escape: 'Path escapes the connection root.',
  unknown: 'Storage operation failed.',
}

export class StorageProviderError extends Error {
  code: StorageErrorCode
  cause?: unknown

  constructor(
    code: StorageErrorCode,
    message = defaultMessages[code],
    cause?: unknown,
  ) {
    super(message)
    this.name = 'StorageProviderError'
    this.code = code
    this.cause = cause
  }
}

export function isStorageProviderError(
  error: unknown,
): error is StorageProviderError {
  return error instanceof StorageProviderError
}

export function isAlreadyExistsError(error: unknown) {
  return (
    error instanceof StorageProviderError && error.code === 'already_exists'
  )
}

export function toStorageProviderError(
  error: unknown,
  fallbackMessage = defaultMessages.unknown,
): StorageProviderError {
  if (error instanceof StorageProviderError) {
    return error
  }

  if (typeof error === 'object' && error !== null) {
    const errorName = Reflect.get(error, 'name')
    const errorMessage = Reflect.get(error, 'message')
    if (errorName === 'PathError') {
      return new StorageProviderError(
        'path_escape',
        typeof errorMessage === 'string'
          ? errorMessage
          : defaultMessages.path_escape,
        error,
      )
    }

    const code = Reflect.get(error, 'code')
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return new StorageProviderError(
        'not_found',
        defaultMessages.not_found,
        error,
      )
    }
    if (code === 'EEXIST') {
      return new StorageProviderError(
        'already_exists',
        defaultMessages.already_exists,
        error,
      )
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return new StorageProviderError(
        'permission_denied',
        defaultMessages.permission_denied,
        error,
      )
    }
  }

  return new StorageProviderError('unknown', fallbackMessage, error)
}
