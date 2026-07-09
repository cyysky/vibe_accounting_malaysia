# Vibe Accounting Malaysia

A cloud-native accounting platform for Malaysian businesses. Vibe Accounting
Malaysia provides a full general-ledger backbone with AR/AP, stock, sales,
purchase, invoicing and financial reporting modules in a modern web stack.

## Stack

- **Backend** — NestJS (TypeScript), JWT auth, REST + OpenAPI
- **Frontend** — Next.js 14 App Router (TypeScript), React Query, Tailwind CSS
- **Shared** — a TypeScript types package consumed by both apps
- **Infra** — Docker Compose with PostgreSQL and **nginx as the single
  host-facing entrypoint**

## Layout

```
.
+- apps/
|  +- api/          NestJS backend (HTTP API, auth, business modules)
|  +- web/          Next.js dashboard (production build served via npx next start)
+- packages/
|  +- shared/       Cross-cutting TypeScript DTOs / enums
+- infra/
   +- docker-compose.yml     # api, web, nginx, postgres
   +- nginx/                # reverse-proxy config (single host port)
   +- postgres/init/        # extensions bootstrap SQL
   +- data/                 # PERSISTENT host data (bind-mounted into containers)
   |  +- postgres/          #   PostgreSQL data files
   |  +- uploads/           #   app file uploads (api -> /var/lib/vibe/uploads)
   |  +- backups/           #   db dumps, snapshots
+- scripts/                  # PowerShell helpers for stack lifecycle + backups
+- docs/
   +- architecture.md
   +- operations.md
```

## Modules

| Module          | Backend   | Frontend route              |
| --------------- | --------- | --------------------------- |
| Account Books   | `account-books` | `/settings/books`     |
| Chart of Accounts | `gl`    | `/dashboard/books`          |
| Journal Entry   | `gl`      | `/dashboard/journal`        |
| Receivables (AR)| `ar`      | `/receivables`              |
| Payables (AP)   | `ap`      | `/payables`                 |
| Sales Orders    | `sales`   | `/sales`                    |
| Purchase Orders | `purchase`| `/purchase`                 |
| Stock / Items   | `stock`   | `/stock`                    |
| Financial Reports | `reports` | `/reports`                |
| Dashboard       | `dashboard` | `/dashboard`              |

## Quick start

### Dev (no Docker, two terminals)

```bash
npm install
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000  (proxies /api/proxy to 3001)
```

### Full stack (Docker, single host port)

```powershell
# from repo root
.\scripts\up.ps1            # start (no rebuild)
.\scripts\up.ps1 -Build     # start after rebuilding images

.\scripts\status.ps1        # container status + data dir sizes
.\scripts\down.ps1          # stop (data intact)
.\scripts\down.ps1 -Volumes # stop + wipe anonymous volumes (data still intact)
```

Once up:

- Web: `http://localhost:8080`
- API: `http://localhost:8080/api`
- Swagger: `http://localhost:8080/api/docs`

Default sign-in: `admin@example.com` / `ChangeMe!123`.

## Persistent data

All runtime data is stored on the host under `infra/data/`. This means data
survives container removal (`scripts/down.ps1`) and can be backed up with
normal filesystem tools.

| Host path                | Container path                | Used by    |
| ------------------------ | ----------------------------- | ---------- |
| `infra/data/postgres/`   | `/var/lib/postgresql/data`    | postgres   |
| `infra/data/uploads/`    | `/var/lib/vibe/uploads`       | api        |
| `infra/data/backups/`    | `/var/lib/vibe/backups`       | api        |

The `infra/data/.gitignore` excludes runtime files from git; only the folder
structure and `.gitkeep` placeholders are committed.

## Backups and restore

```powershell
# Create a snapshot of infra/data/ (Postgres files, uploads, backups)
.\scripts\backup.ps1
.\scripts\backup.ps1 -OutFile before-upgrade.zip

# Stop the stack, restore from a snapshot, and start again
.\scripts\restore.ps1 -Archive infra\data\backups\vibe-backup-2026-07-10.zip

# Stop the stack, wipe infra/data/ entirely, then restore from a snapshot
.\scripts\restore.ps1 -Archive .\my-snapshot.zip -Prune
```

Snapshots are written to `infra/data/backups/`. The backup is a regular zip
file — copy it off-host (rsync, OneDrive, S3, …) for offsite safety.

## Destructive reset

```powershell
.\scripts\reset.ps1         # prompts for confirmation
.\scripts\reset.ps1 -Force  # no prompt
```

This stops the stack, deletes `infra/data/` (Postgres files, uploads, backups),
and recreates the empty skeleton. Run `scripts/up.ps1` afterwards to start
fresh.

## Documentation

- [docs/architecture.md](docs/architecture.md) — system architecture, modules, data model
- [docs/operations.md](docs/operations.md) — backup/restore, troubleshooting, day-2 ops

## Ports

The nginx container is the **only** service with a published host port
(`8080:80`). Postgres, the api and the web live on the internal `internal`
Docker network and are not reachable from the host — ideal when other
containers already occupy common ports on this machine.

To change the public port, edit `infra/.env` (`PUBLIC_PORT`) and the
`ports:` mapping in `infra/docker-compose.yml`.
