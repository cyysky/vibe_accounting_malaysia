# Architecture

## Stack

| Layer        | Technology                                       |
| ------------ | ------------------------------------------------ |
| Database     | PostgreSQL 16 (alpine) — bind-mounted            |
| ORM          | Prisma 5.22                                      |
| API          | NestJS 10 (TypeScript)                           |
| Web          | Next.js 14 (App Router, TypeScript)              |
| Reverse proxy| nginx 1.27                                       |
| Auth         | JWT (access + refresh), bcryptjs                 |
| e-Invoice    | node-forge (X.509 PKCS#7), UBL 2.1 JSON v1.1     |
| Validation   | class-validator (api) + zod (web)                |
| State cache  | TanStack Query (web)                              |

## Modules

Vibe Accounting Malaysia is organised as a flat set of NestJS modules
under `apps/api/src/modules/`.  Each module owns its DTOs, controller,
service, and (optionally) a persistence model.

| Module            | Path                              | Responsibility                                                  |
| ----------------- | --------------------------------- | -------------------------------------------------------------- |
| `auth`            | `modules/auth`                    | JWT login, bcrypt, refresh tokens, profile, user admin         |
| `account-books`   | `modules/account-books`           | Multi-company support                                          |
| `gl`              | `modules/gl`                      | Chart of accounts, journals, tax codes, fiscal years, posting  |
| `ar`              | `modules/ar`                      | Customers, customer invoices (with auto-GL post)               |
| `ap`              | `modules/ap`                      | Suppliers, supplier bills (with auto-GL post)                  |
| `sales`           | `modules/sales`                   | Sales orders + convert-to-invoice flow                         |
| `purchase`        | `modules/purchase`                | Purchase orders                                                 |
| `stock`           | `modules/stock`                   | Items + stock movements + low-stock alerts                     |
| `dashboard`       | `modules/dashboard`              | KPI summary + quick actions                                     |
| `reports`         | `modules/reports`                 | P&L, balance sheet, AR/AP aging, general ledger, bank recon    |
| `einvoice`        | `modules/einvoice`                | MyInvois / LHDNM e-invoice submission + lifecycle              |
| `payments`        | `modules/payments`                | Customer & supplier payments (with auto-GL post)              |
| `credit-notes`    | `modules/credit-notes`            | Refund / sales return documents                                |
| `debit-notes`     | `modules/debit-notes`             | Additional supplier charges                                    |
| `bank-accounts`   | `modules/bank-accounts`           | Cash / bank accounts linked to GL + reconciliation             |
| `recurring`       | `modules/recurring`               | Recurring invoice templates (weekly/monthly/quarterly/yearly) |
| `audit-log`       | `modules/audit-log`               | Global entity-level audit trail + global write interceptor     |
| `health`          | `modules/health`                  | Container / app liveness                                       |

## Posting to GL

When a document is created, the API auto-posts the corresponding journal
entry.  Best-effort: missing GL accounts produce a warning log instead of
rolling back the source transaction, so the system keeps working on
simplified charts of accounts.  Journals can only be posted to an open
fiscal year.

| Source                  | DR                                          | CR                                          |
| ----------------------- | ------------------------------------------- | ------------------------------------------- |
| Customer invoice        | Accounts Receivable (1200)                  | Sales Revenue (4000) + SST Payable (2100)   |
| Supplier bill           | Purchases (5000) + Input Tax (2110)         | Accounts Payable (2000)                     |
| Customer payment        | Bank / Cash (1100 / 1000)                   | Accounts Receivable (1200)                  |
| Supplier payment        | Accounts Payable (2000)                     | Bank / Cash (1100 / 1000)                   |
| Credit note             | Sales Returns (4100) + SST reversal (2100)  | Accounts Receivable (1200)                  |
| Debit note              | Purchases (5000) + Input Tax (2110)         | Accounts Payable (2000)                     |

Sales Returns is typically account `4100`; the system falls back to
`4000` (Sales) if `4100` is not present.

## Document number generation

Document numbers (`INV-00001`, `CN-00001`, `RCP-00001`, `SINV-00001`,
`JV-0001`, …) are allocated by `DocumentSequenceService` which uses a
`document_sequence` table with a single row per `(bookId, prefix)`
pair.  Each allocation runs inside a Postgres transaction that:

1. Acquires a `pg_advisory_xact_lock(bigint)` keyed on a stable FNV-1a
   hash of `(bookId, prefix)` so concurrent writers queue rather than
   race.
2. Upserts the counter row and increments `nextValue` in a single
   `UPDATE … RETURNING` so duplicates are impossible.
3. On first use of a prefix, the counter is seeded from `MAX(number)`
   across the known document tables (so the system can be rolled out
   on a populated database without renumbering).

The lock is released automatically when the transaction commits.

## Cross-module wiring

- `RecurringModule` imports `ArModule` and calls `ArService.createInvoice`
  to materialise a real customer invoice on each `run`.
- `CreditNotesModule` and `DebitNotesModule` both import `GlModule` to
  trigger automatic GL posting via `PostingService`.
- `AuditLogModule` is declared global so any service can inject
  `AuditLogService` (fire-and-forget audit logging that never throws).
  The `AuditInterceptor` is registered via `APP_INTERCEPTOR` so every
  successful `POST/PUT/PATCH/DELETE` controller call is recorded
  automatically, even when the underlying service never explicitly
  calls `AuditLogService.record`.
- `BankAccountsModule` exposes `GET /bank-accounts/:id/reconciliation`
  which returns the opening balance, the running GL balance for the
  linked account, the user-supplied statement balance, and the
  difference between them.
- `EinvoiceModule` pulls supplier MSIC + address from the
  `AccountBook` (industryCode), producing a fully-populated UBL 2.1
  document that includes the MyInvois `TaxTypeCode` on every line
  (`01`–`06` or `E`).

## Database

The Prisma schema models the entire accounting domain.  Most entities
are scoped to an `AccountBook` for multi-tenancy.  All Decimal columns
use `@db.Decimal(18, 2)` (or `(18, 4)` for quantity/uom) to avoid
floating-point drift.  PascalCase identifiers are preserved in the
Postgres schema, so raw SQL must double-quote column names
(`"accountBookId"`, `"nextValue"`) to avoid the lowercasing that
otherwise kicks in for unquoted identifiers.

Key models:

- `AccountBook` (company), `User` (with `Role` enum)
- `Account`, `TaxCode` (with `taxTypeCode` MyInvois field), `FiscalYear`,
  `JournalEntry`, `JournalLine`
- `DocumentSequence` — race-safe counter rows
- `Customer`, `Supplier`, `Item`, `CustomerInvoice`, `CustomerInvoiceLine`,
  `SupplierInvoice`, `SupplierInvoiceLine`
- `SalesOrder`, `SalesOrderLine`, `PurchaseOrder`, `PurchaseOrderLine`
- `CustomerPayment`, `CustomerPaymentApplication`,
  `SupplierPayment`, `SupplierPaymentApplication`
- `CreditNote`, `CreditNoteLine`, `DebitNote`, `DebitNoteLine`
- `RecurringInvoice`, `RecurringInvoiceLine`
- `BankAccount`
- `StockMovement`
- `EinvoiceConfig`, `EinvoiceSubmission`
- `AuditLog`

## Container layout

```text
nginx :8080  ──►  api :3000  ──►  postgres (internal)
                            └─►  redis (internal; not used yet)
```

`docker compose -f infra/docker-compose.yml up -d --build` starts the
whole stack.  Postgres and Redis live on the internal Docker network;
nginx is the only published port.

## Web detail pages and system-wide linking

Every list page deep-links to a detail page and every detail page exposes
shortcut buttons back to the parent workflow:

| List page               | Detail page                       | Shortcut buttons                                |
| ----------------------- | --------------------------------- | ----------------------------------------------- |
| `/receivables`         | `/receivables/[id]`              | Customer payment, credit note, MyInvois buttons |
| `/receivables/customers/[id]` | (same)                       | Outstanding + tax + contact + audit activity    |
| `/payables`            | `/payables/[id]`                 | Supplier payment, debit note                    |
| `/payables/suppliers/[id]`    | (same)                       | Outstanding + tax + contact + audit activity    |
| `/sales`               | `/sales/[id]`                    | Create invoice                                  |
| `/purchase`            | `/purchase/[id]`                 | Record bill                                     |
| `/recurring`           | `/recurring/[id]`                 | Run now, delete, upcoming-due-dates panel       |

- The invoice / bill lists link the customer / supplier name to the
  matching detail page.
- Credit notes / debit notes / customer payments / supplier payments
  lists link the related invoice / bill number to its detail page.
- The dashboard's "Recent activity" feed uses an `entityHref()` helper
  to route each entity name to its detail page based on entity type.

## Testing

20 Jest test suites / 116 unit tests covering: GL (service + posting),
AR, AP, e-invoice mapper (basic + extras), UBL 2.1 validator (basic +
extras), MyInvois HTTP client, recurring, stock, bank accounts, payments
(customer + supplier), credit notes, debit notes, sales orders,
purchase orders, audit log (+ CSV escape rules), auth.

4 live HTTP e2e suites: happy-path, auth-matrix, einvoice, extra.
Extra covers the new `/sales/orders/:id`, `/purchase/orders/:id` and
`/ar/sales-orders/:id/convert-to-invoice` endpoints in addition to the
existing audit-log / cash-flow / dashboard-search / fiscal-year /
journal-reverse coverage.

## Audit log

`AuditLogService` records `CREATE / UPDATE / DELETE / POST / SUBMIT /
CANCEL / POLL / PAY` events.  Two ways an audit row is created:

1. **Explicit** — services call `AuditLogService.record({...})` for
   high-value events (payments posted, e-invoice submitted, etc.).
2. **Implicit** — the global `AuditInterceptor` runs after every
   successful `POST/PUT/PATCH/DELETE` controller invocation and
   auto-logs the action with the entity inferred from the URL path.

Records are written best-effort so a database failure never breaks the
originating transaction.  The web side exposes them under
**Activity** in the sidebar.

## Recurring invoices

A `RecurringInvoice` is a template (customer + frequency + lines).  A
cron-style endpoint `POST /api/recurring/run-due` generates a real
customer invoice for every template whose `nextRunDate <= today` and
advances the date by the configured frequency.  Single-template
materialisation: `POST /api/recurring/:id/run`.
