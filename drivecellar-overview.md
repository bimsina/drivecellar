# DriveCellar Overview

DriveCellar is a self-hosted application that adds a collaborative file-management interface on top of storage you already control.

## Core Model

- The application stores metadata, auth state, permissions, tags, and indexing data in SQLite.
- The actual file contents remain in connected storage backends.
- Each organization can manage multiple storage connections.
- Each connection is either:
  - a local filesystem root visible to the server, or
  - an S3-compatible bucket configuration.

## Request Flow

1. A signed-in user selects an organization.
2. DriveCellar resolves the connection and folder-level permissions for that user.
3. The storage provider performs the read or write against the configured backend.
4. Index metadata is updated inline for normal file operations, and full scans can refresh larger trees.

## Main Features

- Permission-aware file explorer
- Storage connection management
- Background indexing
- Search across indexed metadata
- Organization-wide tags
- Public shared links with optional passwords and expiration

## Deployment Shape

- Production builds are emitted under `.output/`.
- The Node/Docker runtime starts from `.output/server/index.mjs`.
- Docker Compose mounts persistent SQLite data to `/app/.data`.
- Users can add local or S3-compatible storage connections later based on their own deployment setup.

## Operational Notes

- SQLite is the default persistence layer for open-source deployments.
- Drizzle migrations are committed under `drizzle/`.
- The container entrypoint validates required env vars and applies migrations before startup.
