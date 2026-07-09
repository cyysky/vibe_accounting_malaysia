import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountBooksModule } from './modules/account-books/account-books.module';
import { GlModule } from './modules/gl/gl.module';
import { ArModule } from './modules/ar/ar.module';
import { ApModule } from './modules/ap/ap.module';
import { SalesModule } from './modules/sales/sales.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { StockModule } from './modules/stock/stock.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { EinvoiceModule } from './modules/einvoice/einvoice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
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
  ],
})
export class AppModule {}
