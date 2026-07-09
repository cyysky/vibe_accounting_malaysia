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
   |  +- backups/           #   db dumps, exports
+- docs/
   +- architecture.md
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

## Persistent data

All runtime data is stored on the host under `infra/data/`. This means data
survives container removal (`docker compose down` without `-v`) and can be
backed up with normal filesystem tools.

| Host path                | Container path                | Used by    |
| ------------------------ | ----------------------------- | ---------- |
| `infra/data/postgres/`   | `/var/lib/postgresql/data`    | postgres   |
| `infra/data/uploads/`    | `/var/lib/vibe/uploads`       | api        |
| `infra/data/backups/`    | `/var/lib/vibe/backups`       | api        |

The `infra/data/.gitignore` excludes everything from git by default; only the
folder structure and `.gitkeep` placeholders are committed.

## Quick start

### Dev (no Docker, two terminals)

```bash
npm install
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000  (proxies /api/proxy to 3001)
```

### Full stack (Docker, single host port)

```bash
cd infra
cp .env.example .env
docker compose up -d --build
# Web:     http://localhost:8080
# API:     http://localhost:8080/api
# Swagger: http://localhost:8080/api/docs
```

The nginx container is the **only** service with a published host port (`8080:80`).
PostgreSQL lives on the internal `internal` Docker network and is not reachable
from the host — ideal when other containers already occupy common ports on this
machine.

To change the public port, edit `infra/.env` and the `ports:` mapping in
`docker-compose.yml`.

Default sign-in: `admin@example.com` / `ChangeMe!123`.
