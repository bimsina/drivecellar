# DriveCellar

A lightweight, self-hostable file management platform. Connect your own storage — S3-compatible buckets, local drives, or network shares — and get a clean interface with sharing, permissions, and multi-user collaboration.

No vendor lock-in. Your files stay where they are. DriveCellar just gives you a better way to manage them.

---

## Why DriveCellar?

Most file management solutions force a tradeoff. Cloud services like Dropbox and Google Drive are convenient but proprietary — your data lives on someone else's infrastructure. Self-hosted alternatives like Nextcloud try to do everything and end up bloated and complex.

DriveCellar takes a different approach: it doesn't store your files. It connects to storage you already have and provides a modern, collaborative interface on top of it. Think of it as a frontend for your files, wherever they live.

---

## Core Features

### Bring Your Own Storage

DriveCellar connects to storage you already own and manage. No migrations, no new infrastructure, no duplicating data.

- **S3-compatible storage** — AWS S3, Minio, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, and others.
- **Local filesystem** — A folder on the server, a mounted volume, or any path accessible to the DriveCellar instance.
- **Network-attached storage** — NAS devices and network shares, including mounted NFS and SMB shares.

### Multi-Bucket Support

Connect multiple storage backends to a single DriveCellar instance. An S3 bucket for work documents, a local drive for media, a NAS for archives — all accessible from one unified interface.

### Users and Invitations

Invite team members, family, or collaborators to your DriveCellar instance. Each user gets their own account with access only to what you've shared with them.

- Invite users via email
- Self-registration (optional, configurable)
- SSO and OIDC support for organizations

### Permissions and Access Control

Fine-grained, role-based access control at every level.

- **Bucket-level** — Control who can access each connected storage backend.
- **Folder-level** — Share specific folders with specific people or roles.
- **File-level** — Restrict access to individual files when needed.
- **Roles** — Assign roles like viewer, editor, or admin with configurable permissions.

### Public Sharing

Share files and folders with anyone, even people without a DriveCellar account.

- Generate public links for any file or folder
- Set expiration dates on shared links
- Password-protect shared links
- Revoke access at any time

### File Management

A clean, fast interface for everyday file operations.

- Upload and download files
- Create folders
- Move, copy, rename, and delete
- File previews (images, documents, media)
- Search across connected storage

---

## Deployment

DriveCellar is designed to be easy to deploy and easy to maintain.

- **Docker** — A single Docker image. Configure your storage, run the container, and you're ready.
- **Self-hosted** — Clone the repo and deploy on your own infrastructure with full control.
- **Minimal requirements** — DriveCellar is lightweight. No external database servers, no message queues, no background workers. Just the app and your storage.

---

## Philosophy

- **Lightweight over feature-packed.** DriveCellar does file management well and doesn't try to be a calendar, email client, or office suite.
- **Your storage, your rules.** DriveCellar never stores your files. It connects to infrastructure you control.
- **Simple to deploy, simple to maintain.** One container, minimal configuration, no ops burden.
- **Open source, forever.** Free to use, free to modify, free to self-host.

---

## Status

DriveCellar is currently in active development. Follow the project for updates.

---

## License

Open source. License TBD.
