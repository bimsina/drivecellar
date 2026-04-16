import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  FileText,
  Filter,
  Folder,
  HardDrive,
  Loader2,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { Label } from '#/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { ScrollArea } from '#/components/ui/scroll-area'
import { useTRPC } from '#/integrations/trpc/react'
import {
  COLOR_PALETTE,
  getPaletteSwatchStyle,
  type ColorKey,
} from '#/lib/color-palette'
import {
  getExplorerFileDetailRouteTarget,
  getExplorerRouteTarget,
} from '#/lib/explorer-route'
import { useSearchScopeStore } from '#/lib/search-scope-store'
import { cn } from '#/lib/utils'

import type { TRPCRouter } from '#/integrations/trpc/router'
import type { inferRouterOutputs } from '@trpc/server'

type SearchHit =
  inferRouterOutputs<TRPCRouter>['files']['search']['items'][number]

const SEARCH_LIMIT = 30
const DEBOUNCE_MS = 300
type SearchCursor = NonNullable<
  inferRouterOutputs<TRPCRouter>['files']['search']['nextCursor']
>

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

/** cmdk `value` must be stable and unique for selection; keep human-readable for a11y. */
function hitCommandValue(hit: SearchHit) {
  return `${hit.connectionId}::${hit.path}`
}

function resultLinkProps(hit: SearchHit) {
  if (hit.isDirectory) {
    const t = getExplorerRouteTarget(hit.connectionId, hit.path)
    return { to: t.to, params: t.params }
  }
  const t = getExplorerFileDetailRouteTarget(hit.connectionId, hit.path)
  return { to: t.to, params: t.params }
}

function paletteShortcutLabel() {
  if (typeof navigator === 'undefined') {
    return '⌘K'
  }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'
}

function folderScopeLabel(path: string): string {
  if (path === '/') {
    return 'folder'
  }
  const seg = path.split('/').filter(Boolean).at(-1)
  return seg ?? path
}

export function AppHeaderSearch({
  organizationId,
  activeConnectionId,
  activePath,
}: {
  organizationId: string
  activeConnectionId?: string
  activePath?: string
}) {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const [commandOpen, setCommandOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const debouncedDraft = useDebounced(draft, DEBOUNCE_MS)

  const [connectionFilter, setConnectionFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [colorFilter, setColorFilter] = useState<ColorKey[]>([])

  const [filtersOpen, setFiltersOpen] = useState(false)

  const scopeConnectionPref = useSearchScopeStore((s) => s.scopeConnection)
  const scopeDirectoryPref = useSearchScopeStore((s) => s.scopeDirectory)
  const toggleScopeConnection = useSearchScopeStore(
    (s) => s.toggleScopeConnection,
  )
  const toggleScopeDirectory = useSearchScopeStore(
    (s) => s.toggleScopeDirectory,
  )

  const effectiveScopeConnection = Boolean(
    scopeConnectionPref && activeConnectionId,
  )
  const effectiveScopeDirectory = Boolean(
    scopeDirectoryPref && activePath && activePath !== '/',
  )

  const pathPrefixForSearch =
    effectiveScopeDirectory && activePath && activePath !== '/'
      ? activePath
      : undefined

  const scopeLocksConnection = Boolean(
    activeConnectionId && (effectiveScopeConnection || effectiveScopeDirectory),
  )

  const shortcutHint = useMemo(paletteShortcutLabel, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) {
        return
      }
      if (e.key !== 'k' && e.key !== 'K') {
        return
      }
      if (!(e.metaKey || e.ctrlKey)) {
        return
      }
      e.preventDefault()
      setCommandOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const connectionsQuery = useQuery(
    trpc.connections.list.queryOptions(
      { organizationId },
      { enabled: Boolean(organizationId) },
    ),
  )

  const tagsQuery = useQuery(
    trpc.tags.list.queryOptions(undefined, {
      enabled: Boolean(organizationId),
    }),
  )

  const trimmed = debouncedDraft.trim()
  const hasText = trimmed.length > 0
  const hasFilters =
    tagFilter.length > 0 ||
    colorFilter.length > 0 ||
    (scopeLocksConnection ? true : connectionFilter.length > 0) ||
    Boolean(pathPrefixForSearch)
  const canSearch = hasText || hasFilters

  const connectionIdsForSearch = useMemo(() => {
    if (scopeLocksConnection && activeConnectionId) {
      return [activeConnectionId]
    }
    if (connectionFilter.length) {
      return connectionFilter
    }
    return undefined
  }, [scopeLocksConnection, activeConnectionId, connectionFilter])

  const searchInput = useMemo(
    () => ({
      query: hasText ? trimmed : undefined,
      connectionIds: connectionIdsForSearch,
      tagIds: tagFilter.length ? tagFilter : undefined,
      colors: colorFilter.length ? colorFilter : undefined,
      pathPrefix: pathPrefixForSearch,
      limit: SEARCH_LIMIT,
    }),
    [
      trimmed,
      hasText,
      connectionIdsForSearch,
      tagFilter,
      colorFilter,
      pathPrefixForSearch,
    ],
  )

  const searchInfinite = useInfiniteQuery({
    ...trpc.files.search.infiniteQueryOptions(searchInput, {
      getNextPageParam: (lastPage): SearchCursor | undefined =>
        lastPage.hasMore && lastPage.nextCursor
          ? lastPage.nextCursor
          : undefined,
      initialCursor: null,
    }),
    enabled: Boolean(organizationId && canSearch && commandOpen),
  })

  const mergedHits = useMemo(
    () => searchInfinite.data?.pages.flatMap((p) => p.items) ?? [],
    [searchInfinite.data?.pages],
  )

  function goToHit(hit: SearchHit) {
    const link = resultLinkProps(hit)
    void navigate({
      to: link.to,
      params: link.params as never,
    })
    setCommandOpen(false)
  }

  function toggleId(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function toggleColor(key: ColorKey) {
    setColorFilter((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  const activeFilterCount =
    tagFilter.length +
    colorFilter.length +
    (scopeLocksConnection ? 1 : connectionFilter.length) +
    (pathPrefixForSearch ? 1 : 0)

  const activeConnectionName = useMemo(() => {
    if (!activeConnectionId) {
      return undefined
    }
    return (connectionsQuery.data ?? []).find(
      (c) => c.id === activeConnectionId,
    )?.name
  }, [activeConnectionId, connectionsQuery.data])

  const showScopeRow = Boolean(activeConnectionId)

  const emptyLabel = hasText
    ? 'No matches in indexed files.'
    : 'No matches with these filters.'

  const tagsData = tagsQuery.data
  const showTagsSection =
    tagsQuery.isPending || tagsQuery.isError || (tagsData?.length ?? 0) > 0

  /** Without this, `isPending` stays true while the query is disabled (idle), which looks like loading. */
  const searchQueryActive = Boolean(organizationId && canSearch && commandOpen)

  const showInitialLoading =
    searchQueryActive && mergedHits.length === 0 && searchInfinite.isLoading

  const showEmpty =
    mergedHits.length === 0 &&
    !showInitialLoading &&
    !(searchQueryActive && searchInfinite.isError)

  const showError = searchQueryActive && searchInfinite.isError

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-border/80 bg-muted/30 text-muted-foreground hover:bg-muted/50 relative h-8 w-full max-w-full min-w-0 flex-1 justify-start gap-2 rounded-xl px-2.5 font-normal"
        onClick={() => setCommandOpen(true)}
      >
        <Search className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">Search files & folders…</span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-px font-mono text-[10px] font-medium sm:inline-flex">
          {shortcutHint}
        </kbd>
      </Button>

      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        shouldFilter={false}
        showCloseButton={false}
      >
        <div className="border-border flex w-full items-center gap-1 border-b px-2 pb-2">
          <div className="w-full flex-1">
            <CommandInput
              placeholder="Type to search indexed files…"
              value={draft}
              onValueChange={setDraft}
              className="placeholder:text-muted-foreground w-full flex-1 border-0 py-3 shadow-none focus-visible:ring-0"
              aria-label="Search query"
            />
          </div>
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={activeFilterCount > 0 ? 'secondary' : 'ghost'}
                size="icon"
                title="Filters"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Search filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
              >
                <Filter className="size-3.5" />
                {activeFilterCount > 0 ? (
                  <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full text-[9px] font-semibold">
                    {activeFilterCount > 9 ? '9+' : activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(100vw-2rem,20rem)] gap-3 p-3"
              onOpenAutoFocus={(ev) => ev.preventDefault()}
            >
              <div className="space-y-1">
                <p className="text-foreground text-xs font-medium">
                  Connections
                </p>
                {scopeLocksConnection ? (
                  <p className="text-muted-foreground text-xs leading-snug">
                    Limited to &quot;
                    {activeConnectionName ?? 'current connection'}
                    .&quot; Change scope using the chips above.
                  </p>
                ) : null}
                <ScrollArea className="max-h-28 w-full">
                  {connectionsQuery.isPending ? (
                    <p className="text-muted-foreground text-xs">Loading…</p>
                  ) : connectionsQuery.isError ? (
                    <p className="text-destructive text-xs">Could not load.</p>
                  ) : (
                    <div
                      className={cn(
                        'flex flex-col gap-1.5 pr-3',
                        scopeLocksConnection &&
                          'pointer-events-none opacity-50',
                      )}
                    >
                      {(connectionsQuery.data ?? []).map((c) => (
                        <label
                          key={c.id}
                          className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5"
                        >
                          <Checkbox
                            disabled={scopeLocksConnection}
                            checked={connectionFilter.includes(c.id)}
                            onCheckedChange={() =>
                              toggleId(
                                connectionFilter,
                                c.id,
                                setConnectionFilter,
                              )
                            }
                          />
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {c.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {showTagsSection ? (
                <div className="space-y-1">
                  <p className="text-foreground text-xs font-medium">Tags</p>
                  <ScrollArea className="max-h-28 w-full">
                    {tagsQuery.isPending ? (
                      <p className="text-muted-foreground text-xs">Loading…</p>
                    ) : tagsQuery.isError ? (
                      <p className="text-destructive text-xs">
                        Could not load.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5 pr-3">
                        {tagsData?.map((tag) => (
                          <label
                            key={tag.id}
                            className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5"
                          >
                            <Checkbox
                              checked={tagFilter.includes(tag.id)}
                              onCheckedChange={() =>
                                toggleId(tagFilter, tag.id, setTagFilter)
                              }
                            />
                            <span
                              className="size-2 shrink-0 rounded-full border"
                              style={getPaletteSwatchStyle(tag.color)}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {tag.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs font-medium">Entry colors</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PALETTE.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      title={label}
                      onClick={() => toggleColor(key)}
                      className={cn(
                        'size-6 rounded-md border-2 transition-transform hover:scale-105',
                        colorFilter.includes(key)
                          ? 'ring-primary ring-offset-background scale-105 ring-2 ring-offset-1'
                          : 'border-transparent',
                      )}
                      style={getPaletteSwatchStyle(key)}
                    />
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => {
                    setConnectionFilter([])
                    setTagFilter([])
                    setColorFilter([])
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>

        {showScopeRow ? (
          <div className="border-border flex flex-wrap gap-1.5 border-b px-2 py-2">
            <Button
              type="button"
              size="sm"
              variant={effectiveScopeConnection ? 'secondary' : 'outline'}
              className="h-7 gap-1 rounded-full px-2.5 text-xs font-normal"
              title="Search only in the connection you are viewing"
              onClick={() => toggleScopeConnection()}
              aria-pressed={effectiveScopeConnection}
            >
              <HardDrive className="size-3 shrink-0 opacity-70" aria-hidden />
              <span className="max-w-40 truncate">
                In &quot;{activeConnectionName ?? 'this connection'}&quot;
              </span>
            </Button>
            {activePath && activePath !== '/' ? (
              <Button
                type="button"
                size="sm"
                variant={effectiveScopeDirectory ? 'secondary' : 'outline'}
                className="h-7 gap-1 rounded-full px-2.5 text-xs font-normal"
                title="Search under this folder (and subfolders)"
                onClick={() => toggleScopeDirectory()}
                aria-pressed={effectiveScopeDirectory}
              >
                <Folder className="size-3 shrink-0 opacity-70" aria-hidden />
                <span className="max-w-48 truncate">
                  In &quot;{folderScopeLabel(activePath)}&quot;
                </span>
              </Button>
            ) : null}
          </div>
        ) : null}

        <CommandList className="min-h-32 flex-1">
          {showInitialLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-10 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </div>
          ) : showError ? (
            <div className="text-destructive px-4 py-8 text-sm">
              {searchInfinite.error.message}
            </div>
          ) : showEmpty ? (
            <CommandEmpty className="text-muted-foreground py-10 text-sm">
              {canSearch
                ? emptyLabel
                : 'Type a query, set filters, or use scope chips (when browsing a connection).'}
            </CommandEmpty>
          ) : (
            <>
              <CommandGroup heading="Results">
                {mergedHits.map((hit) => (
                  <CommandItem
                    key={`${hit.connectionId}:${hit.path}`}
                    value={hitCommandValue(hit)}
                    keywords={[hit.name, hit.path, hit.connectionName]}
                    onSelect={() => goToHit(hit)}
                    className="cursor-pointer"
                  >
                    <span
                      className="mt-0.5 size-2 shrink-0 rounded-full border"
                      style={getPaletteSwatchStyle(hit.color ?? undefined)}
                      aria-hidden
                    />
                    <span className="bg-primary/10 text-primary hidden max-w-36 shrink-0 truncate rounded-md px-1.5 py-px text-[10px] font-medium sm:inline">
                      {hit.connectionName}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        {hit.isDirectory ? (
                          <Folder className="text-muted-foreground size-3.5 shrink-0" />
                        ) : (
                          <FileText className="text-muted-foreground size-3.5 shrink-0" />
                        )}
                        <span className="truncate">{hit.name}</span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {hit.path}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {searchInfinite.hasNextPage ? (
                <div className="border-border border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-8 w-full text-xs"
                    disabled={searchInfinite.isFetchingNextPage}
                    onClick={() => void searchInfinite.fetchNextPage()}
                  >
                    {searchInfinite.isFetchingNextPage ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  )
}
