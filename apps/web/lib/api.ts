import type {
  AuthResponse,
  LoginRequest,
} from '@account/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccountBook {
  id: string;
  code: string;
  name: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  tin?: string;
  brn?: string;
  industryCode?: string;
  active: boolean;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId?: string;
  currency: string;
  taxCodeId?: string;
  active: boolean;
}

export interface TaxCode {
  id: string;
  code: string;
  name: string;
  rate: number;
  description?: string;
  active: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode?: string;
  description?: string;
  debit: number;
  credit: number;
}
export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  description: string;
  reference?: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  totalDebit: number;
  totalCredit: number;
  lines: JournalLine[];
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  brn?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  currency: string;
  creditLimit: number;
  outstanding: number;
  active: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  brn?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  currency: string;
  outstanding: number;
  active: boolean;
}

export interface CustomerInvoiceLine {
  id?: string;
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxCodeId?: string;
  taxAmount?: number;
  subtotal?: number;
  total?: number;
  lineNo?: number;
}
export interface CustomerInvoice {
  id: string;
  number: string;
  customerId: string;
  customerName?: string;
  date: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  tax: number;
  taxTotal: number;
  total: number;
  paid: number;
  balance: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOID';
  einvoiceStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'SUBMITTED' | 'VALID' | 'INVALID' | 'CANCELLED';
  einvoiceUuid?: string;
  einvoiceLongId?: string;
}

export interface SupplierInvoiceLine extends CustomerInvoiceLine {}
export interface SupplierInvoice {
  id: string;
  number: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOID';
}

export interface Item {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  description?: string;
  uom: string;
  cost: number;
  price: number;
  onHand: number;
  reorderLevel: number;
  classification?: string;
  active: boolean;
}

export interface DashboardSummary {
  cashPosition: number;
  arOutstanding: number;
  apOutstanding: number;
  revenueMtd: number;
  expenseMtd: number;
  inventoryValue: number;
  topCustomers: Array<{ customerId: string; name: string; balance: number }>;
  topItems: Array<{ itemId: string; name: string; onHand: number; reorderLevel: number }>;
  recentInvoices: Array<{ id: string; number: string; customerName: string; total: number; date: string; status: string }>;
  einvoicePending: number;
  einvoiceValid: number;
}

export interface EinvoiceConfig {
  id: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  clientId: string;
  clientSecret: string;
  taxpayerTin: string;
  taxpayerBrn?: string;
  taxpayerName?: string;
  certPath?: string;
  active: boolean;
}
export interface EinvoiceSubmission {
  id: string;
  invoiceId: string;
  documentType: string;
  documentVersion: string;
  format: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  submissionUid?: string;
  documentStatus?: number;
  errorMessage?: string;
  attempts: number;
  submittedAt?: string;
  completedAt?: string;
  invoice?: { id: string; number: string };
}


export interface Payment {
  id: string;
  number: string;
  customerId?: string;
  supplierId?: string;
  customer?: { id: string; name: string };
  supplier?: { id: string; name: string };
  date: string;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  status: string;
  journalId?: string;
  applications: Array<{ id: string; invoiceId: string; amount: number; invoice?: { id: string; number: string; total: number; paid: number; balance: number } }>;
}

export interface StockMovement {
  id: string;
  itemId: string;
  item?: { id: string; code: string; name: string; uom: string };
  type: string;
  quantity: number;
  unitCost: number;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface AgingRow {
  customerId?: string;
  supplierId?: string;
  customerName?: string;
  supplierName?: string;
  buckets: { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number };
  invoices: Array<{ id: string; number: string; date: string; dueDate: string; balance: number; daysOverdue: number }>;
}

export interface GLLine {
  journalId: string;
  journalNumber: string;
  date: string;
  description: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GLSummary {
  accountId: string;
  accountCode: string;
  accountName: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

import type { AuthUser } from '@account/shared';
export type { AuthUser };

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('token', token);
      else localStorage.removeItem('token');
    }
  }

  loadToken(): string | null {
    if (typeof window === 'undefined') return null;
    const t = localStorage.getItem('token');
    this.token = t;
    return t;
  }

  getUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  setUser(user: AuthUser | null): void {
    if (typeof window === 'undefined') return;
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }

  async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const qs = query
      ? '?' +
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    const res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    // For 204 No Content
    if (res.status === 204) return undefined as unknown as T;
    const json = (await res.json()) as ApiEnvelope<T> | T;
    // Unwrap envelope if present
    if (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)) {
      return (json as ApiEnvelope<T>).data;
    }
    return json as T;
  }

  // --- Auth ---
  async login(input: LoginRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('POST', '/auth/login', input);
    this.setToken(res.accessToken);
    this.setUser(res.user);
    return res;
  }

  logout(): void {
    this.setToken(null);
    this.setUser(null);
  }

  me(): Promise<AuthUser> {
    return this.request<AuthUser>('GET', '/auth/profile');
  }

  listUsers(): Promise<AuthUser[]> {
    return this.request<AuthUser[]>('GET', '/auth/users');
  }
  getUserById(id: string): Promise<AuthUser> {
    return this.request<AuthUser>('GET', `/auth/users/${id}`);
  }

  createUser(input: { email: string; name: string; password: string; role: AuthUser['role']; accountBookId?: string }): Promise<AuthUser> {
    return this.request<AuthUser>('POST', '/auth/users', input);
  }

  updateUser(id: string, patch: { name?: string; role?: AuthUser['role']; active?: boolean }): Promise<AuthUser> {
    return this.request<AuthUser>('PATCH', `/auth/users/${id}`, patch);
  }

  deleteUser(id: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('DELETE', `/auth/users/${id}`);
  }

  exportCsv(path: string): void {
    const url = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api') + path;
    fetch(url, { headers: this.token ? { Authorization: `Bearer ${this.token}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        const obj = URL.createObjectURL(blob);
        a.href = obj;
        a.download = path.replace(/^\//, '').replace(/\//g, '-') + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(obj);
      });
  }

  // --- Account books ---
  accountBooks(): Promise<AccountBook[]> {
    return this.request<AccountBook[]>('GET', '/account-books');
  }

  createAccountBook(input: Partial<AccountBook>): Promise<AccountBook> {
    return this.request<AccountBook>('POST', '/account-books', input);
  }

  updateAccountBook(id: string, input: Partial<AccountBook>): Promise<AccountBook> {
    return this.request<AccountBook>('PUT', '/account-books/' + id, input);
  }

  deleteAccountBook(id: string): Promise<void> {
    return this.request<void>('DELETE', '/account-books/' + id);
  }

  // --- GL ---
  accounts(): Promise<Account[]> {
    return this.request<Account[]>('GET', '/gl/accounts');
  }

  createAccount(input: Partial<Account>): Promise<Account> {
    return this.request<Account>('POST', '/gl/accounts', input);
  }

  updateAccount(id: string, input: Partial<Account>): Promise<Account> {
    return this.request<Account>('PUT', `/gl/accounts/${id}`, input);
  }

  deleteAccount(id: string): Promise<void> {
    return this.request<void>('DELETE', `/gl/accounts/${id}`);
  }

  journals(page = 1, pageSize = 50): Promise<PaginatedResponse<JournalEntry>> {
    return this.request<PaginatedResponse<JournalEntry>>('GET', '/gl/journals', undefined, { page, pageSize });
  }

  createJournal(input: { date: string; description: string; reference?: string; lines: Array<{ accountId: string; description?: string; debit: number; credit: number }> }): Promise<JournalEntry> {
    return this.request<JournalEntry>('POST', '/gl/journals', input);
  }

  getJournal(id: string): Promise<JournalEntry> {
    return this.request<JournalEntry>('GET', `gl/journals/${id}`);
  }

  reverseJournal(id: string, reason?: string): Promise<JournalEntry> {
    return this.request<JournalEntry>('POST', `gl/journals/${id}/reverse`, { reason });
  }

  trialBalance(asOf?: string): Promise<Array<{ account: Account; debit: number; credit: number }>> {
    return this.request('GET', '/gl/trial-balance', undefined, asOf ? { asOf } : undefined);
  }

  closeFiscalYear(id: string): Promise<unknown> {
    return this.request('POST', `/gl/fiscal-years/${id}/close`);
  }

  reopenFiscalYear(id: string): Promise<unknown> {
    return this.request('POST', `/gl/fiscal-years/${id}/reopen`);
  }

  customers(): Promise<Customer[]> {
    return this.request<Customer[]>('GET', '/ar/customers');
  }


  createCustomer(input: Partial<Customer>): Promise<Customer> {
    return this.request<Customer>('POST', '/ar/customers', input);
  }

  updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
    return this.request<Customer>('PUT', `/ar/customers/${id}`, input);
  }

  deleteCustomer(id: string): Promise<void> {
    return this.request<void>('DELETE', `/ar/customers/${id}`);
  }
  getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>('GET', '/ar/customers/' + id);
  }

  customerInvoices(page = 1, pageSize = 50, customerId?: string, status?: string): Promise<PaginatedResponse<CustomerInvoice>> {
    return this.request<PaginatedResponse<CustomerInvoice>>('GET', '/ar/invoices', undefined, { page, pageSize, customerId, status });
  }

  getInvoice(id: string): Promise<CustomerInvoice> {
    return this.request<CustomerInvoice>('GET', `/ar/invoices/${id}`);
  }

  createInvoice(input: Partial<CustomerInvoice> & { lines: CustomerInvoiceLine[] }): Promise<CustomerInvoice> {
    return this.request<CustomerInvoice>('POST', '/ar/invoices', input);
  }

  updateInvoice(id: string, input: Partial<CustomerInvoice>): Promise<CustomerInvoice> {
    return this.request<CustomerInvoice>('PUT', `/ar/invoices/${id}`, input);
  }

  deleteInvoice(id: string): Promise<void> {
    return this.request<void>('DELETE', `/ar/invoices/${id}`);
  }

  // --- AP ---
  suppliers(): Promise<Supplier[]> {
    return this.request<Supplier[]>('GET', '/ap/suppliers');
  }

  getSupplier(id: string): Promise<Supplier> {
    return this.request<Supplier>('GET', `/ap/suppliers/${id}`);
  }

  createSupplier(input: Partial<Supplier>): Promise<Supplier> {
    return this.request<Supplier>('POST', '/ap/suppliers', input);
  }

  updateSupplier(id: string, input: Partial<Supplier>): Promise<Supplier> {
    return this.request<Supplier>('PUT', `/ap/suppliers/${id}`, input);
  }

  deleteSupplier(id: string): Promise<void> {
    return this.request<void>('DELETE', `/ap/suppliers/${id}`);
  }
  supplierInvoices(page = 1, pageSize = 50, supplierId?: string, status?: string): Promise<PaginatedResponse<SupplierInvoice>> {
    return this.request<PaginatedResponse<SupplierInvoice>>('GET', '/ap/invoices', undefined, { page, pageSize, supplierId, status });
  }
  getSupplierInvoice(id: string): Promise<SupplierInvoice> {
    return this.request<SupplierInvoice>('GET', `/ap/invoices/${id}`);
  }


  // --- Stock ---
  items(): Promise<Item[]> {
    return this.request<Item[]>('GET', '/stock/items');
  }

  getItem(id: string): Promise<Item> {
    return this.request<Item>('GET', `/stock/items/${id}`);
  }

  createItem(input: Partial<Item>): Promise<Item> {
    return this.request<Item>('POST', '/stock/items', input);
  }

  updateItem(id: string, input: Partial<Item>): Promise<Item> {
    return this.request<Item>('PUT', `/stock/items/${id}`, input);
  }

  deleteItem(id: string): Promise<void> {
    return this.request<void>('DELETE', `/stock/items/${id}`);
  }

  // --- Sales / Purchase ---
  salesOrders(page = 1, pageSize = 50): Promise<PaginatedResponse<{ id: string; number: string; customerName?: string; date: string; total: number; status: string }>> {
    return this.request('GET', '/sales/orders', undefined, { page, pageSize });
  }

  getSalesOrder(id: string): Promise<{
    id: string;
    number: string;
    customerId: string;
    customerName?: string;
    date: string;
    subtotal: number | string;
    taxTotal?: number | string;
    total: number | string;
    status: string;
    notes?: string;
    lines?: Array<{
      id?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      taxCodeId?: string;
      taxAmount?: number;
      subtotal?: number;
      total?: number;
      lineNo?: number;
    }>;
  }> {
    return this.request('GET', '/sales/orders/' + id);
  }

  createSalesOrder(input: { customerId: string; date: string; total: number; notes?: string }): Promise<unknown> {
    return this.request('POST', '/sales/orders', input);
  }

  purchaseOrders(page = 1, pageSize = 50): Promise<PaginatedResponse<{ id: string; number: string; supplierName?: string; date: string; total: number; status: string }>> {
    return this.request('GET', '/purchase/orders', undefined, { page, pageSize });
  }

  getPurchaseOrder(id: string): Promise<{
    id: string;
    number: string;
    supplierId: string;
    supplierName?: string;
    date: string;
    subtotal: number | string;
    taxTotal?: number | string;
    total: number | string;
    status: string;
    notes?: string;
    lines?: Array<{
      id?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      taxCodeId?: string;
      taxAmount?: number;
      subtotal?: number;
      total?: number;
      lineNo?: number;
    }>;
  }> {
    return this.request('GET', '/purchase/orders/' + id);
  }

  createPurchaseOrder(input: { supplierId: string; date: string; total: number; notes?: string }): Promise<unknown> {
    return this.request('POST', '/purchase/orders', input);
  }

  // --- Dashboard / Reports ---
  dashboard(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('GET', '/dashboard/summary');
  }
  dashboardSearch(q: string): Promise<{
    customers: Array<{ id: string; name: string; code: string }>;
    suppliers: Array<{ id: string; name: string; code: string }>;
    items: Array<{ id: string; name: string; code: string }>;
    invoices: Array<{ id: string; number: string; customer: { name: string } }>;
    bills: Array<{ id: string; number: string; supplier: { name: string } }>;
    journals: Array<{ id: string; number: string; description?: string | null }>;
  }> {
    return this.request('GET', '/dashboard/search', undefined, { q });
  }

  pnl(): Promise<{ revenue: number; expenses: number; netIncome: number }> {
    return this.request('GET', '/reports/pnl');
  }

  balanceSheet(): Promise<{ assets: number; liabilities: number; equity: number; balanced: boolean }> {
    return this.request('GET', '/reports/balance-sheet');
  }
  cashFlow(opts: { from?: string; to?: string } = {}): Promise<{
    from: string | null;
    to: string | null;
    operating: number;
    investing: number;
    financing: number;
    net: number;
    periodInflows: number;
    periodOutflows: number;
    journalCount: number;
  }> {
    const q: Record<string, string | undefined> = {};
    if (opts.from) q.from = opts.from;
    if (opts.to) q.to = opts.to;
    return this.request('GET', '/reports/cash-flow', undefined, q);
  }

  executiveSummary(): Promise<DashboardSummary & { pnl: unknown; bs: unknown }> {
    return this.request('GET', '/reports/executive-summary');
  }

  // --- E-Invoice ---
  einvoiceConfigs(): Promise<EinvoiceConfig[]> {
    return this.request<EinvoiceConfig[]>('GET', '/einvoice/configs');
  }

  upsertEinvoiceConfig(input: Partial<EinvoiceConfig>): Promise<EinvoiceConfig> {
    return this.request<EinvoiceConfig>('POST', '/einvoice/configs', input);
  }

  deleteEinvoiceConfig(id: string): Promise<void> {
    return this.request<void>('DELETE', `/einvoice/configs/${id}`);
  }

  validateEinvoice(
    invoiceId: string,
    opts: { version?: string; format?: string; validateOnly?: boolean } = {},
  ): Promise<{
    valid: boolean;
    documentHash: string;
    documentType: string;
    documentVersion: string;
    issues: Array<{ code: string; severity: 'error' | 'warning'; message: string; path?: string }>;
    warnings: Array<{ code: string; severity: 'warning'; message: string; path?: string }>;
    summary: { errors: number; warnings: number };
  }> {
    return this.request('POST', `/einvoice/invoices/${invoiceId}/validate`, opts);
  }
  submitEinvoice(invoiceId: string, opts?: { version?: string; format?: string }): Promise<{ submissionId: string; submissionUid?: string; accepted: unknown[]; rejected: unknown[] }> {
    return this.request('POST', `/einvoice/invoices/${invoiceId}/submit`, opts ?? {});
  }

  einvoiceSubmissions(invoiceId?: string): Promise<EinvoiceSubmission[]> {
    return this.request<EinvoiceSubmission[]>('GET', '/einvoice/submissions', undefined, { invoiceId });
  }

  pollEinvoiceSubmission(id: string): Promise<{ status?: number; statusName?: string; document?: unknown }> {
    return this.request('POST', `/einvoice/submissions/${id}/poll`);
  }

  cancelEinvoice(id: string, reason: string): Promise<unknown> {
    return this.request('POST', `/einvoice/submissions/${id}/cancel`, { reason });
  }

  // --- Tax codes ---
  taxCodes(): Promise<TaxCode[]> {
    return this.request<TaxCode[]>('GET', '/gl/tax-codes');
  }

  createTaxCode(input: Partial<TaxCode>): Promise<TaxCode> {
    return this.request<TaxCode>('POST', '/gl/tax-codes', input);
  }

  updateTaxCode(id: string, input: Partial<TaxCode>): Promise<TaxCode> {
    return this.request<TaxCode>('PUT', `/gl/tax-codes/${id}`, input);
  }

  deleteTaxCode(id: string): Promise<void> {
    return this.request<void>('DELETE', `/gl/tax-codes/${id}`);
  }

  // --- Fiscal years ---
  fiscalYears(): Promise<Array<{ id: string; year: number; startDate: string; endDate: string; closed: boolean }>> {
    return this.request('GET', '/gl/fiscal-years');
  }

  createFiscalYear(input: { year: number; startDate: string; endDate: string }): Promise<unknown> {
    return this.request('POST', '/gl/fiscal-years', input);
  }

  // --- SO -> Invoice conversion ---
  convertSalesOrder(salesOrderId: string): Promise<CustomerInvoice> {
    return this.request<CustomerInvoice>('POST', `/ar/sales-orders/${salesOrderId}/convert-to-invoice`);
  }

  // --- e-Invoice additional ---
  rejectEinvoice(id: string, reason: string): Promise<unknown> {
    return this.request('POST', `/einvoice/submissions/${id}/reject`, { reason });
  }

  getEinvoiceDocument(id: string): Promise<unknown> {
    return this.request('GET', `/einvoice/submissions/${id}/document`);
  }

  getEinvoiceSubmissionDetails(id: string): Promise<unknown> {
    return this.request('GET', `/einvoice/submissions/${id}/details`);
  }

  recentEinvoices(env: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX'): Promise<unknown> {
    return this.request('GET', '/einvoice/recent', undefined, { env });
  }

  validateEinvoiceTin(input: { env?: 'SANDBOX' | 'PRODUCTION'; tin: string; idType: string; idValue: string }): Promise<unknown> {
    return this.request('POST', '/einvoice/validate-tin', input);
  }
// --- Payments ---
  customerPayments(): Promise<Payment[]> {
    return this.request<Payment[]>('GET', '/ar/payments');
  }
  customerPayment(id: string): Promise<Payment> {
    return this.request<Payment>('GET', `/ar/payments/${id}`);
  }
  paymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.request<Payment[]>('GET', '/ar/payments/by-invoice/' + invoiceId);
  }
  createCustomerPayment(input: { customerId: string; date: string; amount: number; method: string; reference?: string; notes?: string; applications: Array<{ invoiceId: string; amount: number }> }): Promise<Payment> {
    return this.request<Payment>('POST', '/ar/payments', input);
  }
  supplierPayments(): Promise<Payment[]> {
    return this.request<Payment[]>('GET', '/ap/payments');
  }
  supplierPayment(id: string): Promise<Payment> {
    return this.request<Payment>('GET', `/ap/payments/${id}`);
  }
  paymentsByBill(billId: string): Promise<Payment[]> {
    return this.request<Payment[]>('GET', '/ap/payments/by-bill/' + billId);
  }
  createSupplierPayment(input: { supplierId: string; date: string; amount: number; method: string; reference?: string; notes?: string; applications: Array<{ invoiceId: string; amount: number }> }): Promise<Payment> {
    return this.request<Payment>('POST', '/ap/payments', input);
  }

  // --- Stock Movements ---
  stockMovements(itemId?: string): Promise<StockMovement[]> {
    return this.request<StockMovement[]>('GET', '/stock/movements', undefined, itemId ? { itemId } : undefined);
  }
  createStockMovement(input: { itemId: string; type: string; quantity: number; date: string; unitCost?: number; reference?: string; notes?: string }): Promise<StockMovement> {
    return this.request<StockMovement>('POST', '/stock/movements', input);
  }

  // --- Reports ---
  arAging(asOf?: string): Promise<{ asOf: string; rows: AgingRow[]; totals: AgingRow["buckets"] }> {
    return this.request('GET', '/reports/ar-aging', undefined, { asOf });
  }
  apAging(asOf?: string): Promise<{ asOf: string; rows: AgingRow[]; totals: AgingRow["buckets"] }> {
    return this.request('GET', '/reports/ap-aging', undefined, { asOf });
  }
  generalLedger(from?: string, to?: string): Promise<{ from: string | null; to: string | null; lines: GLLine[]; accounts: GLSummary[] }> {
    return this.request('GET', '/reports/general-ledger', undefined, { from, to });
  }

  // --- Credit notes ---
  creditNotes(customerId?: string): Promise<CreditNote[]> {
    return this.request<CreditNote[]>('GET', '/ar/credit-notes', undefined, { customerId });
  }
  getCreditNote(id: string): Promise<CreditNote> {
    return this.request<CreditNote>('GET', `/ar/credit-notes/${id}`);
  }
  createCreditNote(input: Partial<CreditNote> & { lines: CreditNote['lines'] }): Promise<CreditNote> {
    return this.request<CreditNote>('POST', '/ar/credit-notes', input);
  }
  updateCreditNote(id: string, input: Partial<CreditNote>): Promise<CreditNote> {
    return this.request<CreditNote>('PUT', `/ar/credit-notes/${id}`, input);
  }
  deleteCreditNote(id: string): Promise<void> {
    return this.request<void>('DELETE', `/ar/credit-notes/${id}`);
  }

  // --- Debit notes ---
  debitNotes(supplierId?: string): Promise<DebitNote[]> {
    return this.request<DebitNote[]>('GET', '/ap/debit-notes', undefined, { supplierId });
  }
  getDebitNote(id: string): Promise<DebitNote> {
    return this.request<DebitNote>('GET', `/ap/debit-notes/${id}`);
  }
  createDebitNote(input: Partial<DebitNote> & { lines: DebitNote['lines'] }): Promise<DebitNote> {
    return this.request<DebitNote>('POST', '/ap/debit-notes', input);
  }
  updateDebitNote(id: string, input: Partial<DebitNote>): Promise<DebitNote> {
    return this.request<DebitNote>('PUT', `/ap/debit-notes/${id}`, input);
  }
  deleteDebitNote(id: string): Promise<void> {
    return this.request<void>('DELETE', `/ap/debit-notes/${id}`);
  }

  // --- Bank accounts ---
  bankAccounts(): Promise<BankAccount[]> {
    return this.request<BankAccount[]>('GET', '/bank-accounts');
  }
  createBankAccount(input: Partial<BankAccount>): Promise<BankAccount> {
    return this.request<BankAccount>('POST', '/bank-accounts', input);
  }
  updateBankAccount(id: string, input: Partial<BankAccount>): Promise<BankAccount> {
    return this.request<BankAccount>('PUT', `/bank-accounts/${id}`, input);
  }
  deleteBankAccount(id: string): Promise<void> {
    return this.request<void>('DELETE', `/bank-accounts/${id}`);
  }

  bankReconciliation(id: string): Promise<BankReconciliation> {
    return this.request<BankReconciliation>('GET', `/bank-accounts/${id}/reconciliation`);
  }

  // --- Recurring invoices ---
  recurringInvoices(): Promise<RecurringInvoice[]> {
    return this.request<RecurringInvoice[]>('GET', '/recurring');
  }
  getRecurring(id: string): Promise<RecurringInvoice> {
    return this.request<RecurringInvoice>('GET', '/recurring/' + id);
  }
  createRecurring(input: Partial<RecurringInvoice> & { lines: RecurringInvoice['lines'] }): Promise<RecurringInvoice> {
    return this.request<RecurringInvoice>('POST', '/recurring', input);
  }
  updateRecurring(id: string, input: Partial<RecurringInvoice>): Promise<RecurringInvoice> {
    return this.request<RecurringInvoice>('PUT', `/recurring/${id}`, input);
  }
  deleteRecurring(id: string): Promise<void> {
    return this.request<void>('DELETE', `/recurring/${id}`);
  }
  runRecurring(id: string): Promise<unknown> {
    return this.request('POST', `/recurring/${id}/run`);
  }
  runDueRecurring(): Promise<unknown> {
    return this.request('POST', '/recurring/run-due');
  }

  // --- Audit log ---
  auditLog(limit = 100, entity?: string, action?: string, since?: string): Promise<AuditLogEntry[]> {
    return this.request<AuditLogEntry[]>('GET', '/audit-log', undefined, { limit, entity, action, since });
  }
  auditLogFor(entity: string, entityId: string): Promise<AuditLogEntry[]> {
    return this.request<AuditLogEntry[]>('GET', `/audit-log/${entity}/${entityId}`);
  }

  // --- Stock movements (alias used by some pages) ---
  createStockReceive(itemId: string, quantity: number, unitCost: number, reference?: string, notes?: string): Promise<StockMovement> {
    return this.createStockMovement({ itemId, type: 'RECEIVE', quantity, unitCost, date: new Date().toISOString(), reference, notes });
  }
}
export const api = new ApiClient();



export interface CreditNote {
  id: string;
  number: string;
  customerId: string;
  customer?: { id: string; name: string };
  invoiceId?: string;
  invoice?: { id: string; number: string };
  date: string;
  reason: string;
  notes?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: 'DRAFT' | 'ISSUED' | 'APPLIED' | 'VOID';
  einvoiceStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'SUBMITTED' | 'VALID' | 'INVALID' | 'CANCELLED';
  einvoiceUuid?: string;
  einvoiceLongId?: string;
  lines: Array<{ id?: string; description: string; quantity: number; unitPrice: number; discount?: number; taxCodeId?: string; taxAmount?: number; subtotal?: number; total?: number; lineNo?: number }>;
}

export interface DebitNote {
  id: string;
  number: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  invoiceId?: string;
  invoice?: { id: string; number: string };
  date: string;
  reason: string;
  notes?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: 'DRAFT' | 'ISSUED' | 'APPLIED' | 'VOID';
  lines: Array<{ id?: string; description: string; quantity: number; unitPrice: number; discount?: number; taxCodeId?: string; taxAmount?: number; subtotal?: number; total?: number; lineNo?: number }>;
}

export interface BankReconciliation {
  bankAccount: BankAccount;
  glAccount: { id: string; code: string; name: string } | null;
  openingBalance: number;
  glBalance: number;
  statementBalance: number;
  difference: number;
  lines: Array<{
    id: string;
    journalId: string;
    date: string;
    journalNumber: string;
    description: string;
    debit: number;
    credit: number;
  }>;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  glAccountCode: string;
  currency: string;
  openingBalance: number;
  active: boolean;
}

export interface RecurringInvoice {
  id: string;
  customerId: string;
  customer?: { id: string; name: string };
  name: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  lastRunDate?: string;
  currency: string;
  notes?: string;
  active: boolean;
  lines: Array<{ id?: string; description: string; quantity: number; unitPrice: number; taxCodeId?: string; lineNo?: number }>;
}

export interface AuditLogEntry {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  message?: string;
  userId?: string;
  user?: { id: string; email: string; name: string };
  createdAt: string;
}
