# DriveCellar

DriveCellar is a self-hosted, multi-tenant file management app that sits on top of your existing storage.

It does **not** store files in its own blob layer. Instead, it connects to:

- Local filesystem paths
- S3-compatible object storage (AWS S3, MinIO, R2, etc.)

and provides a collaborative UI with auth, organizations, permissions, indexing, tagging, and public sharing.

## What You Get

### Core Storage Features

- Multiple storage connections per organization
- Local and S3-compatible provider support
- Browse folders/files from a unified explorer
- File uploads with conflict-safe rename behavior
- Direct downloads (authenticated and shared-link based)
- Create folders, rename paths, delete files/folders
- Optional per-item icon/color metadata in the index

### Collaboration & Access Control

- User auth with Better Auth
- Organization/team model with active organization context
- Roles: `owner`, `admin`, `member`
- Permission layers:
  - Connection default access (`editor` / `viewer` / `none`)
  - Per-user connection overrides
  - Per-user folder-scoped overrides
- Permission-aware explorer visibility (including descendant-folder grants)

### Search & Discovery

- Indexed search across one or more connections
- Search by:
  - Query text (name/path)
  - Connection(s)
  - Tag(s)
  - Color(s)
  - Optional path prefix/scope
- Command-palette style search UI (`Cmd/Ctrl + K`)

### Indexing

- Background full scans per connection (manual + auto trigger)
- Tracks index status and run history
- Cancellation support for running jobs
- Incremental inline index updates on create/rename/delete/upload actions
- Stores file/folder counts and total size summaries

### Tags

- Organization-wide tag catalog (name + color)
- Assign/unassign tags to indexed files/folders
- Tag CRUD with creator/admin protection rules
- Use tags as search filters

### Shared Links

- Create links for files or directories
- Optional password protection
- Optional expiration
- Enable/disable and revoke links
- Public browsing for shared folders + direct file download endpoint

## Tech Stack

- **Framework**: TanStack Start + React 19 + TanStack Router
- **API layer**: tRPC v11
- **DB/ORM**: SQLite + Drizzle ORM (`better-sqlite3`)
- **Auth**: Better Auth (with organization plugin)
- **Styling/UI**: Tailwind CSS v4 + Radix-style component primitives
- **Validation**: Zod
- **State/query**: TanStack Query + Zustand

## Project Structure

- `src/routes` - file routes (pages + API handlers)
- `src/integrations/trpc` - tRPC context/router/procedures
- `src/lib/storage` - storage provider abstraction + local/S3 adapters
- `src/lib/indexing` - full-scan jobs, inline updates, index queries
- `src/lib/permissions.ts` - access resolution logic
- `src/lib/shared-links.ts` - token/password/expiry resolution
- `src/db/schema` - Drizzle schema (auth, connections, index, permissions, tags)

## Environment Variables

Required server env vars (validated in `src/lib/env.ts`):

```bash
DATABASE_URL=./dev.db
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
CONNECTION_ENCRYPTION_KEY=replace-with-a-32-plus-char-secret
```

Notes:

- `DATABASE_URL` points to your SQLite file.
- `CONNECTION_ENCRYPTION_KEY` is used to encrypt S3 credentials at rest in DB JSON.
- `BETTER_AUTH_SECRET` secures auth/session crypto.

## Local Development

### 1. Prerequisites

- Node.js `22.22.0` (from `.node-version`)
- `pnpm`

### 2. Install

```bash
pnpm install
```

### 3. Configure env

Create `.env.local` (or `.env`) with the required variables above.

### 4. Prepare database

```bash
pnpm db:generate
pnpm db:migrate
```

(Use `pnpm db:push` for schema push workflows if preferred.)

### 5. Start app

```bash
pnpm dev
```

App runs on `http://localhost:3000`.

## Scripts

- `pnpm dev` - start dev server
- `pnpm build` - production build
- `pnpm preview` - preview built output
- `pnpm lint` - eslint
- `pnpm format` - prettier write
- `pnpm check` - prettier + eslint fix
- `pnpm db:generate` - drizzle migration generation
- `pnpm db:migrate` - apply migrations
- `pnpm db:push` - push schema directly
- `pnpm db:pull` - pull schema from DB
- `pnpm db:studio` - open Drizzle Studio
- `pnpm auth:generate` - regenerate Better Auth schema file

## Data Model Overview

Key schema groups:

- **Auth/Org**: users, sessions, organizations, members, invitations
- **Connections**: storage connection metadata + encrypted provider config
- **Permissions**:
  - `connection_permissions`
  - `folder_permissions`
  - `shared_links`
- **Indexing**:
  - `file_index`
  - `index_status`
  - `index_runs`
- **Tags**:
  - `tags`
  - `file_tags`

## API Surface (High-Level)

### HTTP routes

- `/api/auth/*` - Better Auth handlers
- `/api/trpc/*` - typed tRPC endpoint
- `/api/files/upload` - multipart upload endpoint
- `/api/files/download` - authenticated download endpoint
- `/api/share/download` - shared-link download endpoint

### tRPC routers

- `connections` - create/update/delete/list/test connection configs
- `files` - list/search/stat/mkdir/rename/delete/update metadata
- `indexing` - start/cancel/status/runs/count
- `permissions` - connection/folder access management + my access
- `sharedLinks` - create/list/update/remove/resolve public links
- `tags` - tag CRUD + assignment/listing for files

## Security Notes

- Path normalization prevents traversal outside connection roots.
- Local provider enforces base-path confinement.
- S3 credentials are encrypted before DB persistence.
- Shared-link passwords are stored as salted `scrypt` hashes.
- Read/write operations are permission-checked against resolved access.

## Current Status

This repository is actively under development. The existing implementation already includes end-to-end core flows for:

- auth + organizations
- storage connection management
- indexed file browsing/search
- permissions
- tags
- shared links

## License

No license file is currently present in the repository.
