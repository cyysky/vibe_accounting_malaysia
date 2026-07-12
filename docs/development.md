# Development guide

This document covers local development, testing, and the type-safety
guarantees enforced across the workspace.

## Prerequisites

- Node.js 20+
- Docker Desktop / Docker Engine 24+
- PowerShell 7 (Windows) or bash (Linux/macOS)

## Repository layout

```
.
├── apps/
│   ├── api/                       NestJS REST API
│   │   ├── prisma/                Prisma schema + seed
│   │   └── src/
│   │       ├── database/          PrismaService, SeedService
│   │       ├── modules/           auth, gl, ar, ap, sales, purchase,
│   │       │                      stock, dashboard, reports, einvoice,
│   │       │                      account-books, health
│   │       ├── common/            guards, decorators, interceptors
│   │       └── main.ts            bootstrap
│   └── web/                       Next.js front end
│       ├── app/                   App Router pages
│       ├── components/            shared UI components
│       └── lib/                   API client + types
├── packages/
│   └── shared/                    Cross-package TypeScript types
├── infra/
│   ├── docker-compose.yml         Service definitions
│   ├── nginx/                     Reverse proxy config
│   ├── data/                      Bind-mounted volumes
│   └── postgres/init/             Postgres init scripts
├── scripts/                       PowerShell + Node admin scripts
└── docs/                          architecture, operations, einvoice, dev
```

## Boot the stack

```powershell
cd C:\workspace\account
docker compose -f infra\docker-compose.yml up -d --build
```

Open <http://localhost:8080> and log in with:

```
email:    admin@example.com
password: ChangeMe!123
```

## Common scripts

| Script                                | Purpose                                 |
| ------------------------------------- | --------------------------------------- |
| `scripts/up.mjs`                      | Start the stack                         |
| `scripts/down.mjs`                    | Stop the stack                          |
| `scripts/status.mjs`                  | Print container status                  |
| `scripts/backup.mjs`                  | Snapshot Postgres + uploads             |
| `scripts/restore.mjs`                 | Restore from a backup                   |
| `scripts/reset.mjs`                   | Wipe all data (destructive)             |
| `scripts/probe-myinvois.mjs`          | Fetch live MyInvois SDK docs            |

Each script has a PowerShell wrapper in the same folder:

```powershell
./scripts/up.ps1
./scripts/status.ps1
./scripts/backup.ps1 -Output ./infra/data/backups/snap.tar.gz
```

## Iterating on the API

1. Edit `apps/api/src/**/*.ts`.
2. `docker compose -f infra\docker-compose.yml build api`
3. `docker compose -f infra\docker-compose.yml up -d api`
4. `docker logs -f vibe-accounting-malaysia-api` to verify.

To force a no-cache rebuild:

```bash
docker build --no-cache -f apps/api/Dockerfile -t vibe-accounting-malaysia/api:0.1.0 .
```

The Dockerfile uses three cache-bust points (`CACHEBUST=1`); bumping
`CACHEBUST` to a new timestamp invalidates the deps layer.

## Iterating on the web

Same workflow with `apps/web/Dockerfile` and the `web` image.

For rapid UI iteration, mount the source directly into a `node:20-alpine`
container running `next dev` (see `docs/operations.md` for the pattern).

## Tests

The test stack has three layers, all of which must pass before merging.

### 1. API unit tests (Jest, in-process)

Fast, no database, no network.  Run from `apps/api`:

```bash
npm test           # runs every *.spec.ts under src/
```

Covers GL (+ posting), AR, AP, e-invoice mapper + validator + einvoice
service orchestration, recurring, stock, stock-movements, bank accounts,
payments, credit notes, debit notes, sales orders, purchase orders,
audit log, auth, account-books.

### 2. Live HTTP smoke (Node, end-to-end CLI)

Talks to the API over HTTP using the seeded admin user.  Idempotent;
re-running adds a fresh invoice/bill/payment each time so the same
counters that used to be a problem with raw doc IDs are handled by
the `DocumentSequence` service.

```bash
node scripts/smoke.mjs
```

### 3. Live HTTP e2e (Jest, talks to running API)

Three Jest suites under `apps/api/test/`:

| Suite                      | Focus                                                                          |
| -------------------------- | ------------------------------------------------------------------------------ |
| `happy-path.live-spec.ts`  | AR/AP sales cycle + auto-POSTED journals + aging reports + audit + bank recon. |
| `auth-matrix.live-spec.ts` | 401 on every protected read without a token; 200/201 with the seeded admin.    |
| `einvoice.live-spec.ts`    | UBL pre-submission validator endpoint + `validateOnly: true` on `/submit`.     |
| `extra.live-spec.ts`       | Audit-log CSV export, cash-flow report, dashboard search, fiscal year close/reopen, journal reversal, AR / AP / sales-order / purchase-order detail endpoints. |

Run with the API already up:

```bash
# PowerShell
$env:API_BASE_URL='http://localhost:8080'
cd apps/api && npx jest --config test/jest-e2e.json
```

or via the helper script:

```bash
./apps/api/.run-e2e.cmd
```

### API unit tests

```bash
docker compose -f infra\docker-compose.yml exec api npm test
```

Current coverage: **24 Jest suites / 178 unit tests** (all passing).

Covers (every suite ships a .spec.ts next to the source it exercises):

- `apps/api/src/modules/auth/auth.service.spec.ts` — login, password check, JWT round-trip
- `apps/api/src/modules/account-books/account-books.service.spec.ts` — CRUD, name uniqueness
- `apps/api/src/modules/gl/gl.service.spec.ts` + `posting.service.spec.ts` — journal balancing, posting
- `apps/api/src/modules/ar/ar.service.spec.ts` + `ap/ap.service.spec.ts` — invoice / bill lifecycle, GL post
- `apps/api/src/modules/sales/sales.service.spec.ts` + `purchase/purchase.service.spec.ts` — order lifecycle
- `apps/api/src/modules/stock/stock.service.spec.ts` + `stock-movements.service.spec.ts` — items + movements
- `apps/api/src/modules/bank-accounts/bank-accounts.service.spec.ts` — bank CRUD + reconciliation
- `apps/api/src/modules/payments/payments.service.spec.ts` — customer + supplier payment application
- `apps/api/src/modules/credit-notes/credit-notes.service.spec.ts` + `debit-notes.service.spec.ts`
- `apps/api/src/modules/recurring/recurring.service.spec.ts` — template due-date generation
- `apps/api/src/modules/reports/reports.service.spec.ts` — P&L, BS, aging, GL aggregation
- `apps/api/src/modules/dashboard/dashboard.service.spec.ts` — KPI summary, search palette
- `apps/api/src/modules/audit-log/audit-log.service.spec.ts` — list filters (entity/action/since) + CSV escape
- `apps/api/src/modules/einvoice/einvoice.service.spec.ts` — submit / poll / cancel orchestration
- `apps/api/src/modules/einvoice/clients/myinvois.client.spec.ts` — HTTP client against nock
- `apps/api/src/modules/einvoice/mappers/invoice-v1.1.mapper.spec.ts` + `mappers.extras.spec.ts` — UBL shape + PaymentMeans/InvoicePeriod/AdditionalDocumentReference
- `apps/api/src/modules/einvoice/validators/ubl.validator.spec.ts` + `validators.extras.spec.ts` — pre-submission validator + PaymentMeansCode / PayeeFinancialAccount / AdditionalDocumentReference rules

### API e2e tests

```bash
docker compose -f infra\docker-compose.yml exec api npm run test:e2e
```

Adds supertest-based full HTTP tests against the running NestJS app.

## Prisma migrations

The schema is the source of truth.  To add a column:

1. Edit `apps/api/prisma/schema.prisma`.
2. From a sidecar container on the `infra_internal` network:

   ```bash
   docker run --rm --network infra_internal \
     -v $PWD/apps/api/prisma:/work -w /work node:20-alpine sh -c \
     "npm install prisma@5.22.0 --no-audit --no-fund && \
      DATABASE_URL=postgresql://vibe:vibe@postgres:5432/vibe \
      ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss"
   ```

3. Rebuild the API image so the new `prisma generate` is baked in.

For longer-lived migrations use `prisma migrate dev` instead of `db push`
to produce SQL files.

## Type safety

- The shared package (`@account/shared`) defines DTOs and entity types
  consumed by both API and web.
- The web's `lib/api.ts` re-declares types locally so it stays
  self-contained and doesn't depend on shared types at build time.
- Both API and web enforce strict TypeScript via `tsc --noEmit` in CI
  (and via the docker build, which runs `nest build` / `next build`).

## Adding a new module

1. Create `apps/api/src/modules/<name>/<name>.module.ts`,
   `.<name>.service.ts`, `.<name>.controller.ts`.
2. If it owns new entities, add models to `apps/api/prisma/schema.prisma`
   and run `prisma db push` (see above).
3. Register the module in `apps/api/src/app.module.ts`.
4. Add typed methods to `apps/web/lib/api.ts`.
5. Build a new page under `apps/web/app/<route>/page.tsx`.
6. Update `apps/web/components/sidebar.tsx` with a link.
7. Update `docs/architecture.md` if it introduces new patterns.

## Adding an e-Invoice document type

1. Edit `apps/api/src/modules/einvoice/mappers/` (add a new mapper for the
   document type).
2. Add a method to `EinvoiceService.submit<Document>` and a controller
   route.
3. Document the new endpoint in `docs/einvoice.md`.
