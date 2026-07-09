# Architecture

Vibe Accounting Malaysia is a cloud-native accounting platform built around a
modular service-oriented stack. The web frontend talks to a NestJS API over
REST/JSON, with PostgreSQL as the system of record.

```
+-------------------+         REST/JSON          +-------------------+
|  Next.js (apps/web)  <---------------------->  |  NestJS (apps/api)  |
+-------------------+                            +-------------------+
        |                                                  |
        |  React Query, Tailwind                           |  Prisma (planned)
        v                                                  v
  Browser session                              +-------------------------+
  (httpOnly JWT cookie)                        |  PostgreSQL (container) |
                                              +-------------------------+
```

## Backend (apps/api)

- **NestJS** modules own one business domain each (`AccountBookModule`,
  `GlModule`, `ArModule`, `ApModule`, `SalesModule`, `PurchaseModule`,
  `StockModule`, `InvoicingModule`, `ReportsModule`).
- JWT auth via `@nestjs/jwt`; refresh tokens handled in `AuthService`.
- **Validation** with `class-validator` / `class-transformer` on every DTO.
- **OpenAPI** generated at `/api/docs` via `@nestjs/swagger`.
- Currently backed by an in-memory `DataStore`; the next step is to swap it
  for Prisma against the PostgreSQL container in `infra/`.

## Frontend (apps/web)

- **Next.js 14 App Router** with React Server Components for layout and
  React Query for client-side data fetching.
- **Tailwind CSS** for styling; icons from `lucide-react`.
- Forms built with `react-hook-form` + `zod` resolvers that share schemas with
  the API via the `packages/shared` workspace.
- The `Sidebar` and `Topbar` carry the **Vibe Accounting Malaysia** brand.

## Data model

- `AccountBook` — a logical company within the platform.
- `User`, `Role`, `Permission` — auth & RBAC.
- `Account`, `JournalEntry`, `JournalLine` — GL backbone.
- `Customer`, `Supplier`, `CustomerInvoice`, `SupplierInvoice` — AR / AP.
- `Item`, `StockMovement` — Stock module.
- `TaxCode`, `Currency`, `FiscalYear`, `NumberSequence` — config.

## Branding & deployment

- npm workspace: `vibe-accounting-malaysia`
- Docker images: `vibe-accounting-malaysia/api`, `vibe-accounting-malaysia/web`
- Container names: `vibe-accounting-malaysia-{api,web,nginx,postgres,redis,minio}`
- PostgreSQL role/db: `vibe`
- Single host-facing port: **8080** (nginx); all data services on the internal
  Docker bridge network only.
