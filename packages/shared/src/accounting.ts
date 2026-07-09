import type { ID, PaginationQuery } from './common';

// --- Account books ---
export interface AccountBook {
  id: ID;
  code: string;
  name: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  active: boolean;
  createdAt: string;
}

// --- Chart of accounts ---
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export interface Account {
  id: ID;
  code: string;
  name: string;
  type: AccountType;
  parentId?: ID;
  currency: string;
  taxCodeId?: ID;
  active: boolean;
}

// --- Journal ---
export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export interface JournalEntry {
  id: ID;
  number: string;
  date: string;
  description: string;
  reference?: string;
  status: JournalStatus;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLine[];
}
export interface JournalLine {
  id: ID;
  accountId: ID;
  accountCode?: string;
  description?: string;
  debit: number;
  credit: number;
}
export interface CreateJournalDto {
  date: string;
  description: string;
  reference?: string;
  lines: Array<{
    accountId: ID;
    description?: string;
    debit: number;
    credit: number;
  }>;
}

// --- Customers / Suppliers ---
export interface Customer {
  id: ID;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  currency: string;
  creditLimit: number;
  outstanding: number;
  active: boolean;
}
export interface Supplier {
  id: ID;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  currency: string;
  outstanding: number;
  active: boolean;
}

// --- Invoices ---
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOID';
export interface CustomerInvoice {
  id: ID;
  number: string;
  customerId: ID;
  customerName?: string;
  date: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
}
export interface SupplierInvoice {
  id: ID;
  number: string;
  supplierId: ID;
  supplierName?: string;
  date: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
}

// --- Stock ---
export interface Item {
  id: ID;
  code: string;
  barcode?: string;
  name: string;
  description?: string;
  uom: string;
  cost: number;
  price: number;
  onHand: number;
  reorderLevel: number;
  active: boolean;
}

// --- Dashboard ---
export interface DashboardSummary {
  cashPosition: number;
  arOutstanding: number;
  apOutstanding: number;
  revenueMtd: number;
  expenseMtd: number;
  topCustomers: Array<{ customerId: ID; name: string; balance: number }>;
  topItems: Array<{ itemId: ID; name: string; soldQty: number }>;
}

export interface ListInvoicesQuery extends PaginationQuery {
  customerId?: ID;
  status?: InvoiceStatus;
  from?: string;
  to?: string;
}
