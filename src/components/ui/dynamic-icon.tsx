import type { ComponentType, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import dynamicIconImports from 'lucide-react/dynamicIconImports.mjs'

import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'

type DynamicIconProps = {
  value: string | null
  fallback?: ReactNode
  className?: string
  size?: number
}

const iconComponentCache = new Map<
  string,
  ComponentType<{ className?: string; size?: number }>
>()

function parseIconValue(value: string | null) {
  if (!value) {
    return null
  }

  const separatorIndex = value.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return null
  }

  const library = value.slice(0, separatorIndex)
  const name = value.slice(separatorIndex + 1)

  return { library, name }
}

export function DynamicIcon({
  value,
  fallback = null,
  className,
  size = 16,
}: DynamicIconProps) {
  const parsed = useMemo(() => parseIconValue(value), [value])
  const [IconComponent, setIconComponent] = useState<ComponentType<{
    className?: string
    size?: number
  }> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!parsed || parsed.library !== 'lucide') {
      setIconComponent(null)
      setIsLoading(false)
      return
    }

    const importer =
      dynamicIconImports[parsed.name as keyof typeof dynamicIconImports]
    if (!importer) {
      setIconComponent(null)
      setIsLoading(false)
      return
    }

    const cached = iconComponentCache.get(parsed.name)
    if (cached) {
      setIconComponent(cached)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    void importer()
      .then((module) => {
        iconComponentCache.set(parsed.name, module.default)
        setIconComponent(module.default)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [parsed])

  if (!parsed) {
    return <>{fallback}</>
  }

  if (parsed.library === 'emoji') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center leading-none',
          className,
        )}
        style={{ fontSize: size }}
      >
        {parsed.name}
      </span>
    )
  }

  if (parsed.library === 'lucide') {
    if (isLoading) {
      return <Skeleton className={cn('size-4 rounded-sm', className)} />
    }

    if (IconComponent) {
      return <IconComponent className={className} size={size} />
    }
  }

  return <>{fallback}</>
}
