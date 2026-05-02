# DriveCellar

Self-hosted file browser for storage you already own. Point it at local folders or S3-compatible buckets—no new blob store. You get a web UI to browse, search, tag, share with links, and manage team access. Less heavy than a full cloud suite; nicer than SSH or the raw S3 console.

https://github.com/user-attachments/assets/a390a4a7-3171-400b-a1b1-403d47f0a138

## Quick start

**1. Env file**

```bash
node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); fs.writeFileSync('.env.local', ['PORT=3000','BETTER_AUTH_URL=http://localhost:3000','DATABASE_URL=/app/.data/drivecellar.db',`BETTER_AUTH_SECRET=${crypto.randomBytes(48).toString('hex')}`,`CONNECTION_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`,''].join('\n'))"
```

**2. Run**

```bash
docker run -d \
  --name drivecellar \
  -p 3000:3000 \
  --env-file .env.local \
  -v drivecellar-data:/app/.data \
  ghcr.io/bimsina/drivecellar:latest
```

Open [http://localhost:3000](http://localhost:3000).

**Inline env (no file)**

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

## One-click deploy

Includes a **Dockerfile**. Pick a host that runs containers and attaches a **persistent disk** for SQLite ([Published image](#published-image), [`.env.example`](./.env.example)).

<table>
  <tbody>
    <tr>
      <td align="center" width="50%">
        <a href="https://railway.com/new/template?template=https://github.com/bimsina/drivecellar" title="Deploy on Railway">
          <img src="https://railway.com/button.svg" alt="Deploy on Railway" width="180" />
        </a>
      </td>
      <td align="center" width="50%">
        <a href="https://render.com/deploy?repo=https://github.com/bimsina/drivecellar" title="Deploy to Render">
          <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" width="185" />
        </a>
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://app.koyeb.com/deploy?type=git&amp;repository=github.com/bimsina/drivecellar&amp;branch=main&amp;name=drivecellar" title="Deploy to Koyeb">
          <img src="https://www.koyeb.com/static/images/deploy/button.svg" alt="Deploy to Koyeb" width="185" />
        </a>
      </td>
      <td align="center">
        <a href="https://deploy.cloud.run/?git_repo=https://github.com/bimsina/drivecellar" title="Run on Google Cloud">
          <img src="https://deploy.cloud.run/button.svg" alt="Run on Google Cloud" width="185" />
        </a>
      </td>
    </tr>
  </tbody>
</table>

After deploy, set **`DATABASE_URL`**, **`BETTER_AUTH_URL`** (public `https://` origin), **`BETTER_AUTH_SECRET`**, **`CONNECTION_ENCRYPTION_KEY`**. Most hosts set **`PORT`**. The container runs **`pnpm db:migrate`** then starts the app.

Mount persistent storage where **`DATABASE_URL`** points (e.g. `/app/.data`). **Cloud Run** is ephemeral unless you add a [volume](https://cloud.google.com/run/docs/configuring/services/volumes)—Railway, Render, or Koyeb are simpler for SQLite-on-disk.

## Features

| Area             | What you get                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Storage**      | Local paths; S3-compatible (AWS, MinIO, R2, etc.); multiple connections per org                                                     |
| **Files**        | Browse, upload/download, folders, rename, delete                                                                                    |
| **Search & org** | Indexed search; tags; optional colors/icons                                                                                         |
| **Sharing**      | Public links with optional expiry and password                                                                                      |
| **Auth & teams** | Email/password; workspaces; roles (`owner`, `admin`, `member`); connection defaults and per-user overrides (including folder scope) |
| **Indexing**     | Auto index on new connection; manual re-index; optional schedule (e.g. 5m–weekly); run history (trigger, status, counts, errors)    |

## First run

1. Sign up → create a workspace → add a connection (indexed on create; optional **re-index schedule** in the form).
2. Browse, or use **Indexing** on a connection for re-runs and history after the first index finishes.

## Docker Compose

```bash
cp .env.example .env.local   # fill secrets
docker compose up -d
```

Uses `ghcr.io/bimsina/drivecellar:latest` and a persistent volume. Pin: `DRIVECELLAR_IMAGE_TAG=v0.1.0 docker compose up -d`.

## How it works

App metadata lives in **SQLite**; file bytes stay on your connected backend. DriveCellar indexes names, paths, sizes, types for fast UI and search. Permissions are enforced in the app before any read/write against storage.

## Published image

- Repo: [github.com/bimsina/drivecellar](https://github.com/bimsina/drivecellar)
- Image: `ghcr.io/bimsina/drivecellar:<tag>` · default port **3000**

Required: `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `CONNECTION_ENCRYPTION_KEY`

```bash
docker run \
  --name drivecellar \
  --publish 3000:3000 \
  --env-file .env.local \
  --volume drivecellar-data:/app/.data \
  ghcr.io/bimsina/drivecellar:v0.1.0
```

## Build from source

```bash
pnpm install
pnpm setup:env
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

## Local development

```bash
pnpm install
pnpm setup:env
pnpm db:migrate
pnpm dev
```

Production preview: `pnpm build` then `pnpm preview`.

## Tech stack

TanStack Start, React 19, TanStack Router, tRPC, SQLite (`better-sqlite3`), Drizzle, Better Auth, Tailwind CSS v4, Zod.

## Notes

- Local providers are restricted to their base path.
- S3 credentials are encrypted in SQLite.
- Shared-link passwords are salted hashes.
- MIT — see [LICENSE.md](./LICENSE.md).
