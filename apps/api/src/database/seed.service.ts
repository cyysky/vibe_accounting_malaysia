import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs';
import { AccountType, Role } from '@prisma/client';

/**
 * Idempotent bootstrap seed.
 *
 * Runs once on container start to guarantee a usable demo account book
 * (chart of accounts, tax codes, demo customers, suppliers, items, opening
 * journal, admin user).  Safe to run repeatedly: every entity is upserted.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const start = Date.now();
    try {
      await this.seed();
      this.logger.log(`Seed completed in ${Date.now() - start}ms`);
    } catch (err) {
      this.logger.error('Seed failed', err as Error);
    }
  }

  private async seed(): Promise<void> {
    const adminEmail = 'admin@example.com';
    const adminPassword = 'ChangeMe!123';

    // --- account book ---
    const book = await this.prisma.accountBook.upsert({
      where: { code: 'DEMO' },
      update: {},
      create: {
        code: 'DEMO',
        name: 'Demo Company Sdn Bhd',
        baseCurrency: 'MYR',
        fiscalYearStartMonth: 1,
        tin: 'IG1234567890',
        brn: '202101012345 (1234567-X)',
        industryCode: '62010',
      },
    });

    // --- admin user ---
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await this.prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, name: 'Admin', role: Role.OWNER, accountBookId: book.id, active: true },
      create: {
        email: adminEmail,
        passwordHash,
        name: 'Admin',
        role: Role.OWNER,
        accountBookId: book.id,
        active: true,
      },
    });

    // --- chart of accounts ---
    const accountsData: Array<{ code: string; name: string; type: AccountType }> = [
      { code: '1000', name: 'Cash on Hand', type: AccountType.ASSET },
      { code: '1100', name: 'Bank', type: AccountType.ASSET },
      { code: '1200', name: 'Accounts Receivable', type: AccountType.ASSET },
      { code: '1500', name: 'Inventory', type: AccountType.ASSET },
      { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY },
      { code: '2100', name: 'SST Payable', type: AccountType.LIABILITY },
      { code: '3000', name: 'Owner Equity', type: AccountType.EQUITY },
      { code: '4000', name: 'Sales Revenue', type: AccountType.REVENUE },
      { code: '5000', name: 'Cost of Goods Sold', type: AccountType.EXPENSE },
      { code: '6000', name: 'Operating Expenses', type: AccountType.EXPENSE },
    ];
    for (const a of accountsData) {
      await this.prisma.account.upsert({
        where: { accountBookId_code: { accountBookId: book.id, code: a.code } },
        update: { name: a.name, type: a.type },
        create: { ...a, accountBookId: book.id, currency: 'MYR', active: true },
      });
    }

    // --- tax codes ---
    const taxCodes = [
      { code: 'SVAT-08', name: 'Sales Tax 8%', rate: 0.08 },
      { code: 'SVAT-10', name: 'Sales Tax 10%', rate: 0.10 },
      { code: 'ZRL', name: 'Zero-Rated', rate: 0.0 },
      { code: 'EXEMPT', name: 'Exempt', rate: 0.0 },
    ];
    for (const t of taxCodes) {
      await this.prisma.taxCode.upsert({
        where: { accountBookId_code: { accountBookId: book.id, code: t.code } },
        update: { name: t.name, rate: t.rate },
        create: { ...t, accountBookId: book.id, active: true },
      });
    }

    // --- customers ---
    const customers = [
      { code: 'C001', name: 'Acme Trading', email: 'ap@acme.test', taxId: 'C1234567890', brn: '202001012222 (2222222-X)' },
      { code: 'C002', name: 'Globex Sdn Bhd', email: 'finance@globex.test', taxId: 'C2345678901' },
      { code: 'C003', name: 'Initech Malaysia', email: 'sales@initech.test' },
    ];
    for (const c of customers) {
      await this.prisma.customer.upsert({
        where: { accountBookId_code: { accountBookId: book.id, code: c.code } },
        update: { name: c.name },
        create: { ...c, accountBookId: book.id, currency: 'MYR', creditLimit: 50000, outstanding: 0, active: true },
      });
    }

    // --- suppliers ---
    const suppliers = [
      { code: 'S001', name: 'Initech Supplies', email: 'sales@initech.test' },
      { code: 'S002', name: 'Hooli Wholesale', email: 'ap@hooli.test', taxId: 'S9876543210' },
    ];
    for (const s of suppliers) {
      await this.prisma.supplier.upsert({
        where: { accountBookId_code: { accountBookId: book.id, code: s.code } },
        update: { name: s.name },
        create: { ...s, accountBookId: book.id, currency: 'MYR', outstanding: 0, active: true },
      });
    }

    // --- items ---
    const items = [
      { code: 'ITEM-001', name: 'Standard Widget', uom: 'PCS', cost: 10, price: 25, onHand: 500, reorderLevel: 100 },
      { code: 'ITEM-002', name: 'Premium Widget', uom: 'PCS', cost: 18, price: 45, onHand: 180, reorderLevel: 50 },
      { code: 'ITEM-003', name: 'Service Hour', uom: 'HOUR', cost: 50, price: 120, onHand: 9999, reorderLevel: 0 },
    ];
    for (const i of items) {
      await this.prisma.item.upsert({
        where: { accountBookId_code: { accountBookId: book.id, code: i.code } },
        update: { name: i.name },
        create: { ...i, accountBookId: book.id, active: true },
      });
    }

    // --- opening journal (only if no journals exist) ---
    const jcount = await this.prisma.journalEntry.count({ where: { accountBookId: book.id } });
    if (jcount === 0) {
      const cash = await this.prisma.account.findUnique({
        where: { accountBookId_code: { accountBookId: book.id, code: '1000' } },
      });
      const equity = await this.prisma.account.findUnique({
        where: { accountBookId_code: { accountBookId: book.id, code: '3000' } },
      });
      if (cash && equity) {
        await this.prisma.journalEntry.create({
          data: {
            accountBookId: book.id,
            number: 'JV-0001',
            date: new Date(),
            description: 'Opening balances',
            status: 'POSTED',
            totalDebit: 100000,
            totalCredit: 100000,
            lines: {
              create: [
                { accountId: cash.id, debit: 100000, credit: 0 },
                { accountId: equity.id, debit: 0, credit: 100000 },
              ],
            },
          },
        });
      }
    }
  }
}
