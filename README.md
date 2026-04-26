# DriveCellar

DriveCellar is a self-hosted file browser for storage you already own.

Instead of uploading everything into a new platform, you point DriveCellar at your existing folders or S3-compatible storage and get a clean web app for browsing, sharing, organizing, and controlling access.

If you want something lighter than a full cloud suite, but friendlier than managing files directly on a server or bucket, this is the gap DriveCellar is meant to fill.

## Quick Start

You can start DriveCellar without cloning this repo.

### 1. Generate an env file

```bash
node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); fs.writeFileSync('.env.local', ['PORT=3000','BETTER_AUTH_URL=http://localhost:3000','DATABASE_URL=/app/.data/drivecellar.db',`BETTER_AUTH_SECRET=${crypto.randomBytes(48).toString('hex')}`,`CONNECTION_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`,''].join('\n'))"
```

### 2. Run the app

```bash
docker run -d \
  --name drivecellar \
  -p 3000:3000 \
  --env-file .env.local \
  -v drivecellar-data:/app/.data \
  ghcr.io/bimsina/drivecellar:latest
```

Then open [http://localhost:3000](http://localhost:3000).

### No env file?

If you would rather pass everything inline, use:

```bash
docker run -d \
  --name drivecellar \
  -p 3000:3000 \
  -e PORT=3000 \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e DATABASE_URL=/app/.data/drivecellar.db \
  -e BETTER_AUTH_SECRET="$(openssl rand -hex 48)" \
  -e CONNECTION_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -v drivecellar-data:/app/.data \
  ghcr.io/bimsina/drivecellar:latest
```

## What You Get

- Browse files from a normal web UI
- Connect local folders or S3-compatible storage
- Search indexed files and folders
- Organize content with tags, colors, and icons
- Share files or folders with public links
- Control access for different people inside a team workspace

## What DriveCellar Is Not

- Not a hosted cloud storage provider
- Not a Dropbox or Google Drive clone with its own blob store
- Not a document editor or office suite
- Not a media processing platform

## First-Time Setup

After the container starts:

1. Create your first account.
2. Create a team workspace.
3. Add a storage connection.
4. Start indexing and begin browsing.

## Slightly More Structured Setup

If you prefer using Docker Compose instead of one long command, the repo includes a compose file that pulls the published image from GHCR.

### 1. Create an env file

```bash
cp .env.example .env.local
```

Then replace the placeholder secrets in `.env.local`.

### 2. Start the app

```bash
docker compose up -d
```

### 3. Open the app

Visit [http://localhost:3000](http://localhost:3000).

By default, Compose uses:

- the published image `ghcr.io/bimsina/drivecellar:latest`
- a persistent Docker volume for app data

To pin a specific version:

```bash
DRIVECELLAR_IMAGE_TAG=v0.1.0 docker compose up -d
```

## What It Does

### Storage

- Connect local filesystem paths
- Connect S3-compatible storage such as AWS S3, MinIO, or Cloudflare R2
- Manage multiple storage connections per organization

### File Management

- Browse folders and files
- Upload files
- Download files
- Create folders
- Rename files and folders
- Delete files and folders

### Collaboration

- Email/password sign-in
- Team workspace model
- Roles: `owner`, `admin`, `member`
- Connection-level default access
- Per-user connection overrides
- Folder-scoped per-user overrides

### Organization

- Indexed search
- Tags
- Optional colors and icons for indexed items
- Public share links with expiration and password support

## How It Works

DriveCellar keeps app data in SQLite, but your files stay in the storage you connect.

It indexes metadata like file names, paths, sizes, and types so the UI can search and browse quickly. When someone opens, downloads, uploads, or shares a file, DriveCellar checks permissions in the app layer and then performs the action against the connected storage backend.

## Published Image

- Repository: [github.com/bimsina/drivecellar](https://github.com/bimsina/drivecellar)
- Image: `ghcr.io/bimsina/drivecellar:<tag>`
- Default port: `3000`

Required environment variables:

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `CONNECTION_ENCRYPTION_KEY`

Example with an env file:

```bash
docker run \
  --name drivecellar \
  --publish 3000:3000 \
  --env-file .env.local \
  --volume drivecellar-data:/app/.data \
  ghcr.io/bimsina/drivecellar:v0.1.0
```

## Build From Source

If you want to build the image from a local checkout instead of pulling from GHCR:

### 1. Install dependencies

```bash
pnpm install
```

### 2. Generate local secrets

```bash
pnpm setup:env
```

### 3. Build and run with Compose

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

## Local Development

```bash
pnpm install
pnpm setup:env
pnpm db:migrate
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

To preview the production build locally:

```bash
pnpm build
pnpm preview
```

## Useful Scripts

- `pnpm dev` - start the development server
- `pnpm build` - build the Nitro production output
- `pnpm start` - run the Nitro Node server from `.output/server/index.mjs`
- `pnpm preview` - locally preview the production build
- `pnpm setup:env` - generate `.env.local`
- `pnpm db:migrate` - apply committed Drizzle migrations
- `pnpm db:generate` - generate a new migration from schema changes
- `pnpm db:push` - push schema changes directly to SQLite
- `pnpm db:studio` - open Drizzle Studio
- `pnpm lint` - run ESLint

## Tech Stack

- TanStack Start
- React 19
- TanStack Router
- tRPC
- SQLite with `better-sqlite3`
- Drizzle ORM
- Better Auth
- Tailwind CSS v4
- Zod

## Repository Guide

- `src/routes` - UI routes and HTTP handlers
- `src/integrations/trpc` - tRPC context and routers
- `src/lib/storage` - local and S3 provider implementations
- `src/lib/indexing` - indexing jobs and index queries
- `src/lib/permissions.ts` - effective access resolution
- `src/lib/shared-links.ts` - shared-link access logic
- `src/db/schema` - Drizzle schema definitions
- `drizzle` - committed SQL migrations
- `docker` - container entrypoint assets
- `.output` - Nitro build output

## Notes

- Local storage providers are confined to their configured base path.
- S3 credentials are encrypted before being stored in SQLite.
- Shared-link passwords are stored as salted hashes.
- This repository is MIT licensed. See [LICENSE.md](./LICENSE.md).
