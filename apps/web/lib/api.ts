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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'CLERK' | 'VIEWER';
  accountBookId?: string;
}

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

  trialBalance(): Promise<Array<{ account: Account; debit: number; credit: number }>> {
    return this.request('GET', '/gl/trial-balance');
  }

  // --- AR ---
  customers(): Promise<Customer[]> {
    return this.request<Customer[]>('GET', '/ar/customers');
  }

  getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>('GET', `/ar/customers/${id}`);
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

  customerInvoices(page = 1, pageSize = 50, customerId?: string): Promise<PaginatedResponse<CustomerInvoice>> {
    return this.request<PaginatedResponse<CustomerInvoice>>('GET', '/ar/invoices', undefined, { page, pageSize, customerId });
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

  supplierInvoices(page = 1, pageSize = 50, supplierId?: string): Promise<PaginatedResponse<SupplierInvoice>> {
    return this.request<PaginatedResponse<SupplierInvoice>>('GET', '/ap/invoices', undefined, { page, pageSize, supplierId });
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

  createSalesOrder(input: { customerId: string; date: string; total: number; notes?: string }): Promise<unknown> {
    return this.request('POST', '/sales/orders', input);
  }

  purchaseOrders(page = 1, pageSize = 50): Promise<PaginatedResponse<{ id: string; number: string; supplierName?: string; date: string; total: number; status: string }>> {
    return this.request('GET', '/purchase/orders', undefined, { page, pageSize });
  }

  createPurchaseOrder(input: { supplierId: string; date: string; total: number; notes?: string }): Promise<unknown> {
    return this.request('POST', '/purchase/orders', input);
  }

  // --- Dashboard / Reports ---
  dashboard(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('GET', '/dashboard/summary');
  }

  pnl(): Promise<{ revenue: number; expenses: number; netIncome: number }> {
    return this.request('GET', '/reports/pnl');
  }

  balanceSheet(): Promise<{ assets: number; liabilities: number; equity: number; balanced: boolean }> {
    return this.request('GET', '/reports/balance-sheet');
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
    // Quick & dirty: not exposed yet, return empty.  Add a real endpoint later.
    return Promise.resolve([]);
  }
}

export const api = new ApiClient();


