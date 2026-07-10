import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AccountBooksModule } from "./modules/account-books/account-books.module";
import { GlModule } from "./modules/gl/gl.module";
import { ArModule } from "./modules/ar/ar.module";
import { ApModule } from "./modules/ap/ap.module";
import { SalesModule } from "./modules/sales/sales.module";
import { PurchaseModule } from "./modules/purchase/purchase.module";
import { StockModule } from "./modules/stock/stock.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { EinvoiceModule } from "./modules/einvoice/einvoice.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { CreditNotesModule } from "./modules/credit-notes/credit-notes.module";
import { DebitNotesModule } from "./modules/debit-notes/debit-notes.module";
import { BankAccountsModule } from "./modules/bank-accounts/bank-accounts.module";
import { RecurringModule } from "./modules/recurring/recurring.module";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditLogModule,
    HealthModule,
    AuthModule,
    AccountBooksModule,
    GlModule,
    ArModule,
    ApModule,
    SalesModule,
    PurchaseModule,
    StockModule,
    DashboardModule,
    ReportsModule,
    EinvoiceModule,
    PaymentsModule,
    CreditNotesModule,
    DebitNotesModule,
    BankAccountsModule,
    RecurringModule,
  ],
})
export class AppModule {}
