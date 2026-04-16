import type { ComponentType } from 'react'
import { useMemo, useState, useEffect } from 'react'
import dynamicIconImports from 'lucide-react/dynamicIconImports.mjs'
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react'
import { Search, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { DynamicIcon } from '#/components/ui/dynamic-icon'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { cn } from '#/lib/utils'

type IconPickerProps = {
  value: string | null
  onChange: (value: string | null) => void
  allowClear?: boolean
}

const iconNames = Object.keys(dynamicIconImports)
const iconComponentCache = new Map<
  string,
  ComponentType<{ className?: string; size?: number }>
>()

function useLazyIcon(name: string) {
  const [IconComponent, setIconComponent] = useState<ComponentType<{
    className?: string
    size?: number
  }> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const cached = iconComponentCache.get(name)
    if (cached) {
      setIconComponent(cached)
      setIsLoading(false)
      return
    }

    const importer = dynamicIconImports[name as keyof typeof dynamicIconImports]
    if (!importer) {
      setIconComponent(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    void importer()
      .then((module) => {
        iconComponentCache.set(name, module.default)
        setIconComponent(module.default)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [name])

  return { IconComponent, isLoading }
}

function IconCell({
  name,
  selected,
  onSelect,
}: {
  name: string
  selected: boolean
  onSelect: (value: string) => void
}) {
  const { IconComponent, isLoading } = useLazyIcon(name)

  return (
    <button
      type="button"
      title={name}
      onClick={() => onSelect(`lucide:${name}`)}
      className={cn(
        'hover:bg-accent flex size-9 items-center justify-center rounded-md border',
        selected ? 'border-primary bg-primary/10' : 'border-transparent',
      )}
    >
      {isLoading ? (
        <Skeleton className="size-4 rounded-sm" />
      ) : IconComponent ? (
        <IconComponent className="size-4" />
      ) : null}
    </button>
  )
}

export function IconPicker({
  value,
  onChange,
  allowClear = true,
}: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'icons' | 'emoji'>('icons')

  const filteredIconNames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return iconNames.slice(0, 240)
    }

    return iconNames
      .filter((name) => name.includes(normalizedQuery))
      .slice(0, 240)
  }, [query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
        >
          <span className="bg-muted flex size-5 items-center justify-center rounded-sm">
            <DynamicIcon value={value} className="size-4" />
          </span>
          <span className="text-muted-foreground">
            {value ? 'Change icon' : 'Choose icon'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[min(80vh,34rem)] w-88 overflow-hidden p-3"
        align="start"
      >
        <Tabs
          value={tab}
          onValueChange={(next) => setTab(next as 'icons' | 'emoji')}
          className="min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="icons">Icons</TabsTrigger>
            <TabsTrigger value="emoji">Emoji</TabsTrigger>
          </TabsList>

          <TabsContent
            value="icons"
            className="flex min-h-0 flex-col gap-3 pt-2"
          >
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2 size-4" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value.toLowerCase())}
                placeholder="Search icons"
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-60 rounded-md border p-2">
              <div className="grid grid-cols-8 gap-1">
                {filteredIconNames.map((name) => (
                  <IconCell
                    key={name}
                    name={name}
                    selected={value === `lucide:${name}`}
                    onSelect={(nextValue) => {
                      onChange(nextValue)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="emoji" className="pt-2">
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <EmojiPicker
                theme="auto"
                onEmojiClick={(emoji: EmojiClickData) => {
                  onChange(`emoji:${emoji.emoji}`)
                  setOpen(false)
                }}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                width="100%"
              />
            </div>
          </TabsContent>
        </Tabs>
        {allowClear && value ? (
          <div className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <X className="size-4" />
              Clear icon
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
