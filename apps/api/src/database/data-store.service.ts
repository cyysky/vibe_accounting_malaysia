import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type {
  Account,
  AccountBook,
  CreateJournalDto,
  Customer,
  CustomerInvoice,
  Item,
  JournalEntry,
  Supplier,
  SupplierInvoice,
} from '@account/shared';

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'CLERK' | 'VIEWER';
  accountBookId?: string;
}

interface SalesOrder {
  id: string;
  number: string;
  customerId: string;
  date: string;
  total: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}
interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  date: string;
  total: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}

@Injectable()
export class DataStore implements OnModuleInit {
  private readonly logger = new Logger(DataStore.name);

  readonly accountBooks: AccountBook[] = [];
  readonly users: UserRecord[] = [];
  readonly accounts: Account[] = [];
  readonly journals: JournalEntry[] = [];
  readonly customers: Customer[] = [];
  readonly suppliers: Supplier[] = [];
  readonly customerInvoices: CustomerInvoice[] = [];
  readonly supplierInvoices: SupplierInvoice[] = [];
  readonly items: Item[] = [];
  readonly salesOrders: SalesOrder[] = [];
  readonly purchaseOrders: PurchaseOrder[] = [];

  onModuleInit(): void {
    this.seed();
    this.logger.log('In-memory data store seeded');
  }

  newId(): string {
    return randomUUID();
  }

  private seed(): void {
    const book: AccountBook = {
      id: 'book-demo',
      code: 'DEMO',
      name: 'Demo Company Sdn Bhd',
      baseCurrency: 'MYR',
      fiscalYearStartMonth: 1,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.accountBooks.push(book);

    const passwordHash = bcrypt.hashSync('ChangeMe!123', 10);
    this.users.push({
      id: 'user-admin',
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin',
      role: 'OWNER',
      accountBookId: book.id,
    });

    const seedAccounts: Array<Omit<Account, 'id'>> = [
      { code: '1000', name: 'Cash on Hand', type: 'ASSET', currency: 'MYR', active: true },
      { code: '1100', name: 'Bank', type: 'ASSET', currency: 'MYR', active: true },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', currency: 'MYR', active: true },
      { code: '1500', name: 'Inventory', type: 'ASSET', currency: 'MYR', active: true },
      { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', currency: 'MYR', active: true },
      { code: '3000', name: 'Owner Equity', type: 'EQUITY', currency: 'MYR', active: true },
      { code: '4000', name: 'Sales Revenue', type: 'REVENUE', currency: 'MYR', active: true },
      { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', currency: 'MYR', active: true },
      { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', currency: 'MYR', active: true },
    ];
    for (const a of seedAccounts) this.accounts.push({ id: this.newId(), ...a });

    const cash = this.accounts.find((a) => a.code === '1000')!;
    const equity = this.accounts.find((a) => a.code === '3000')!;
    this.journals.push({
      id: this.newId(),
      number: 'JV-0001',
      date: new Date().toISOString().slice(0, 10),
      description: 'Opening balances',
      status: 'POSTED',
      totalDebit: 100000,
      totalCredit: 100000,
      lines: [
        { id: this.newId(), accountId: cash.id, accountCode: cash.code, debit: 100000, credit: 0 },
        { id: this.newId(), accountId: equity.id, accountCode: equity.code, debit: 0, credit: 100000 },
      ],
    });

    this.customers.push(
      { id: this.newId(), code: 'C001', name: 'Acme Trading', email: 'ap@acme.test', currency: 'MYR', creditLimit: 50000, outstanding: 12500, active: true },
      { id: this.newId(), code: 'C002', name: 'Globex Sdn Bhd', email: 'finance@globex.test', currency: 'MYR', creditLimit: 100000, outstanding: 8200, active: true },
    );
    this.suppliers.push(
      { id: this.newId(), code: 'S001', name: 'Initech Supplies', email: 'sales@initech.test', currency: 'MYR', outstanding: 4500, active: true },
      { id: this.newId(), code: 'S002', name: 'Hooli Wholesale', email: 'ap@hooli.test', currency: 'MYR', outstanding: 0, active: true },
    );

    this.items.push(
      { id: this.newId(), code: 'ITEM-001', name: 'Standard Widget', uom: 'PCS', cost: 10, price: 25, onHand: 500, reorderLevel: 100, active: true },
      { id: this.newId(), code: 'ITEM-002', name: 'Premium Widget', uom: 'PCS', cost: 18, price: 45, onHand: 180, reorderLevel: 50, active: true },
    );
  }

  createJournal(dto: CreateJournalDto): JournalEntry {
    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Journal does not balance: debit ${totalDebit} vs credit ${totalCredit}`);
    }
    const number = `JV-${String(this.journals.length + 1).padStart(4, '0')}`;
    const entry: JournalEntry = {
      id: this.newId(),
      number,
      date: dto.date,
      description: dto.description,
      reference: dto.reference,
      status: 'POSTED',
      totalDebit,
      totalCredit,
      lines: dto.lines.map((l) => {
        const acc = this.accounts.find((a) => a.id === l.accountId);
        return {
          id: this.newId(),
          accountId: l.accountId,
          accountCode: acc?.code,
          description: l.description,
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
        };
      }),
    };
    this.journals.push(entry);
    return entry;
  }
}
