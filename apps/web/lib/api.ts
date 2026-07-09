import type {
  Account,
  AccountBook,
  AuthResponse,
  CreateJournalDto,
  Customer,
  CustomerInvoice,
  DashboardSummary,
  JournalEntry,
  LoginRequest,
  Paginated,
  Supplier,
  SupplierInvoice,
} from '@account/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return (await res.json()) as T;
  }

  // --- Auth ---
  login(input: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/auth/login', input);
  }

  // --- Account books ---
  accountBooks(): Promise<AccountBook[]> {
    return this.request<AccountBook[]>('GET', '/account-books');
  }

  // --- GL ---
  accounts(): Promise<Account[]> {
    return this.request<Account[]>('GET', '/gl/accounts');
  }

  journals(): Promise<Paginated<JournalEntry>> {
    return this.request<Paginated<JournalEntry>>('GET', '/gl/journals');
  }

  createJournal(dto: CreateJournalDto): Promise<JournalEntry> {
    return this.request<JournalEntry>('POST', '/gl/journals', dto);
  }

  trialBalance(): Promise<Array<{ account: Account; debit: number; credit: number }>> {
    return this.request('GET', '/gl/trial-balance');
  }

  // --- AR ---
  customers(): Promise<Customer[]> {
    return this.request<Customer[]>('GET', '/ar/customers');
  }

  customerInvoices(): Promise<Paginated<CustomerInvoice>> {
    return this.request<Paginated<CustomerInvoice>>('GET', '/ar/invoices');
  }

  // --- AP ---
  suppliers(): Promise<Supplier[]> {
    return this.request<Supplier[]>('GET', '/ap/suppliers');
  }

  supplierInvoices(): Promise<Paginated<SupplierInvoice>> {
    return this.request<Paginated<SupplierInvoice>>('GET', '/ap/invoices');
  }

  // --- Dashboard ---
  dashboard(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('GET', '/dashboard/summary');
  }

  // --- Reports ---
  pnl(): Promise<{ revenue: number; expenses: number; netIncome: number }> {
    return this.request('GET', '/reports/pnl');
  }

  balanceSheet(): Promise<{ assets: number; liabilities: number; equity: number; balanced: boolean }> {
    return this.request('GET', '/reports/balance-sheet');
  }

  // --- Stock ---
  items<T = unknown>(): Promise<T[]> {
    return this.request<T[]>('GET', '/stock/items');
  }
}

export const api = new ApiClient();
