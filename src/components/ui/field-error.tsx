import { cn } from '#/lib/utils'

type FieldErrorProps = {
  errors?: readonly unknown[]
  className?: string
}

function getErrorMessage(error: unknown): string | null {
  if (!error) {
    return null
  }

  if (typeof error === 'string') {
    return error
  }

  if (Array.isArray(error)) {
    for (const item of error) {
      const message = getErrorMessage(item)
      if (message) {
        return message
      }
    }

    return null
  }

  if (
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return null
}

export function FieldError({ errors, className }: FieldErrorProps) {
  const message = errors?.map(getErrorMessage).find(Boolean)

  if (!message) {
    return null
  }

  return <p className={cn('text-destructive text-xs', className)}>{message}</p>
}
