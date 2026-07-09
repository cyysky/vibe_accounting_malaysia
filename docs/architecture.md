# Architecture

## Stack

| Layer        | Technology                                |
| ------------ | ----------------------------------------- |
| Database     | PostgreSQL 16 (alpine) — bind-mounted     |
| ORM          | Prisma 5.22                               |
| API          | NestJS 10 (TypeScript)                    |
| Web          | Next.js 14 (App Router, TypeScript)       |
| Reverse proxy| nginx 1.27                                |
| Auth         | JWT (access + refresh), bcryptjs          |
| e-Invoice    | node-forge (X.509 PKCS#7), UBL 2.1 JSON v1.1 |
| Validation   | class-validator + zod (web)               |

## Container layout

```
┌──────────────────────────────────────────────────────────────────┐
│                      HOST :8080 (nginx)                          │
│                         (only published port)                   │
└──────────────────┬─────────────────────────────────┬────────────┘
                   │ /api/*                          │ /, /dashboard, …
                   ▼                                 ▼
        ┌─────────────────────┐             ┌────────────────────┐
        │ vibe-accounting-    │             │ vibe-accounting-   │
        │ malaysia-api        │             │ malaysia-web       │
        │ (NestJS, :3000)     │             │ (Next.js, :3000)   │
        └──────────┬──────────┘             └────────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │ vibe-accounting-    │
        │ malaysia-postgres   │
        │ (Postgres 16, :5432)│   ◄─ ONLY on internal network
        └─────────────────────┘
```

All data services (Postgres) live on the `internal` Docker network only —
**no host port is published**.  The only host-mapped port is **8080** on
nginx, which proxies `/api/*` to the API container and everything else to
the web container.

This keeps the platform isolated from any other Postgres already running
on this host.  To run a one-off migration, attach a sidecar container to
the `infra_internal` network (see `scripts/probe-myinvois.mjs` for the
network pattern).

## Database schema (Prisma)

Core entities (see `apps/api/prisma/schema.prisma` for the canonical
definition):

- **AccountBook** — a logical company within the platform.  Holds TIN,
  BRN, MSIC industry code, base currency, fiscal year start month.
- **User** — email + bcrypt password hash, role (OWNER/ADMIN/ACCOUNTANT/
  CLERK/VIEWER), foreign key to AccountBook.
- **Account** — chart-of-accounts row, scoped to AccountBook.  Supports
  parent/child tree.
- **TaxCode** — SST/GST codes, scoped to AccountBook, rate as decimal.
- **FiscalYear** — fiscal year boundary tracker, scoped to AccountBook.
- **JournalEntry / JournalLine** — double-entry journal vouchers.  Enforces
  totalDebit == totalCredit at the service layer.
- **Customer / Supplier** — AR/AP counterparties with TIN, BRN, address.
- **Item** — stock items with cost, price, on-hand, reorder level,
  MyInvois classification code.
- **CustomerInvoice / CustomerInvoiceLine** — AR invoices, computes
  subtotal/tax/total at create time, maintains customer.outstanding.
- **SupplierInvoice / SupplierInvoiceLine** — AP bills, mirrors AR.
- **SalesOrder / PurchaseOrder** — pre-invoice documents.
- **EinvoiceConfig** — per-(AccountBook, environment) MyInvois
  credentials and certificate path.
- **EinvoiceSubmission** — every submission attempt with full payload,
  MyInvois response, status code, attempts, timestamps.

Unique compound keys are used per-AccountBook (`accountBookId_code` on
Account/Customer/Supplier/Item/TaxCode, `accountBookId_environment` on
EinvoiceConfig, etc.).

## API layering

```
HTTP request
   │
   ▼
Controller  — REST shape, Swagger annotations, DTO validation
   │
   ▼
Service     — Business logic, transactions, throws domain errors
   │
   ▼
PrismaService — Postgres queries
```

All controllers declare `@ApiTags`, `@ApiBearerAuth`, and `@UseGuards(JwtAuthGuard)`.
The `CurrentUser` decorator extracts the JWT-decoded user; account-book-scoped
endpoints require `user.accountBookId`.

Global `ValidationPipe` enforces DTO validation (`whitelist`,
`forbidNonWhitelisted`, `transform`).

`TransformInterceptor` wraps every response in `{ data, meta? }`.

## Frontend layout

Next.js App Router under `apps/web/app`.  Shared components live in
`apps/web/components/`:

- `ui/Button.tsx` — primary/secondary/danger/ghost variants with loading spinner
- `ui/DataTable.tsx` — generic typed table with loading/empty states
- `ui/Modal.tsx` — accessible modal with ESC close and scroll lock
- `ui/Form.tsx` — Field, Input, Select, Textarea, Badge, EinvoiceStatusBadge

`lib/api.ts` is a hand-rolled typed HTTP client.  It unwraps the
`{ data, meta? }` envelope, persists JWT and user to localStorage, and
exposes typed methods per endpoint.

The `ProtectedShell` component redirects unauthenticated users to `/login`.

## e-Invoice (MyInvois) flow

```
Customer Invoice (status: ISSUED)
       │
       ▼  POST /api/einvoice/invoices/:id/submit
   EinvoiceService.submitInvoice
       │
       ├─► buildUblInvoice   (mapper: invoice+lines → UBL 2.1 JSON v1.1)
       ├─► JsonSigner.signP12 (X.509 PKCS#7, node-forge)
       └─► MyInvoisClient.submitDocuments
              │
              ▼
         preprod-api.myinvois.hasil.gov.my  (or api.myinvois.hasil.gov.my)
              │
              ▼
         EinvoiceSubmission (documentStatus: 1=submitted)
              │
              ▼  POST /api/einvoice/submissions/:id/poll
         MyInvoisClient.searchDocuments
              │
              ▼
         EinvoiceSubmission (documentStatus: 2=valid | 3=invalid | 4=cancelled)
         CustomerInvoice.einvoiceStatus updated
```

For local dev set `DISABLE_SIGNING=1` to substitute a placeholder
signature; the MyInvois SANDBOX will still reject it but the rest of the
flow is exercised.

## Data persistence

- Postgres data files: `infra/data/postgres/` on the host, bind-mounted to
  `/var/lib/postgresql/data` inside the container.  Survives
  `docker compose down` (no `-v`).
- App uploads: `infra/data/uploads/` → `/var/lib/vibe/uploads`
- App backups: `infra/data/backups/` → `/var/lib/vibe/backups`

Use `scripts/backup.mjs` / `scripts/restore.mjs` to snapshot Postgres +
upload dir as a single tarball under `infra/data/backups/`.

## Local development

`docs/development.md` covers local iteration, tests, and the type-safety
guarantees enforced across the workspace.
