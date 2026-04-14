import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import { AppLoading } from '#/components/app-loading'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { useTRPC } from '#/integrations/trpc/react'
import { cn } from '#/lib/utils'

function buildShareDownloadUrl(token: string, path: string, password?: string) {
  const params = new URLSearchParams({
    token,
    path,
  })

  if (password) {
    params.set('password', password)
  }

  return `/api/share/download?${params.toString()}`
}

function formatBytes(n: number | null) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: Date | null) {
  if (!value) return 'No expiration'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

function joinSharePath(basePath: string, childPath: string) {
  if (childPath === '/') {
    return basePath
  }
  return childPath
}

type SharedLinkPageProps = {
  token: string
  path: string
}

export function SharedLinkPage({ token, path }: SharedLinkPageProps) {
  const { password } = useSearch({ from: '/s/$token' })
  const navigate = useNavigate()
  const trpc = useTRPC()
  const [draftPassword, setDraftPassword] = useState(password ?? '')

  const shareQuery = useQuery(
    trpc.sharedLinks.resolvePublic.queryOptions({
      token,
      path,
      password,
    }),
  )

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void navigate({
      to: '/s/$token',
      params: { token },
      search: { password: draftPassword || undefined },
      replace: true,
    })
  }

  if (shareQuery.isPending) {
    return <AppLoading label="Opening shared link…" />
  }

  if (shareQuery.isError) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-12">
        <Card className="w-full space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">Shared link unavailable</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {shareQuery.error.message}
            </p>
          </div>

          {(shareQuery.error.data?.code === 'UNAUTHORIZED' ||
            shareQuery.error.message === 'Password required.') && (
            <form className="space-y-3" onSubmit={submitPassword}>
              <div className="space-y-2">
                <Label htmlFor="share-password">Password</Label>
                <Input
                  id="share-password"
                  type="password"
                  value={draftPassword}
                  onChange={(event) => setDraftPassword(event.target.value)}
                  placeholder="Enter the share password"
                />
              </div>
              <Button type="submit">Open link</Button>
            </form>
          )}
        </Card>
      </div>
    )
  }

  const data = shareQuery.data

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">DriveCellar shared link</p>
        <h1 className="text-2xl font-semibold">
          {data.entry.name || 'Shared root'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {data.isDirectory
            ? `Browsing ${data.currentPath}`
            : `File size: ${formatBytes(data.entry.size)}`}
        </p>
        <p className="text-muted-foreground text-sm">
          Expires: {formatDate(data.expiresAt)}
        </p>
      </header>

      {data.isDirectory ? (
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Files</h2>
          </div>
          <div className="divide-y">
            {data.entries.length === 0 ? (
              <div className="text-muted-foreground px-4 py-6 text-sm">
                This folder is empty.
              </div>
            ) : (
              data.entries.map((entry) => (
                <div
                  key={entry.path}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    {entry.isDirectory ? (
                      <Link
                        to="/s/$token/$"
                        params={{
                          token,
                          _splat: joinSharePath(path, entry.path).slice(1),
                        }}
                        search={{ password }}
                        className={cn(
                          'hover:text-primary font-medium transition-colors',
                        )}
                      >
                        {entry.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{entry.name}</span>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {entry.isDirectory ? 'Folder' : formatBytes(entry.size)}
                    </p>
                  </div>

                  {!entry.isDirectory && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={buildShareDownloadUrl(
                          token,
                          entry.path,
                          password,
                        )}
                        download
                      >
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-medium">{data.entry.name}</h2>
            <p className="text-muted-foreground text-sm">
              {formatBytes(data.entry.size)}
            </p>
          </div>
          <Button asChild>
            <a href={buildShareDownloadUrl(token, '/', password)} download>
              Download file
            </a>
          </Button>
        </Card>
      )}
    </div>
  )
}
