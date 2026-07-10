/**
 * Live HTTP e2e tests that talk to a running API over HTTP.
 *
 * The API wraps every response in `{ data: ... }` and POSTs return 201.
 *
 * Configurable via env:
 *   API_BASE_URL  default http://localhost:8080
 *   API_EMAIL     default admin@example.com
 *   API_PASSWORD  default ChangeMe!123
 */
const BASE = process.env.API_BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.API_EMAIL || 'admin@example.com';
const PASSWORD = process.env.API_PASSWORD || 'ChangeMe!123';

async function http(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers['Authorization'] = `Bearer ${init.token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: res.status, body };
}

function data<T = any>(body: any, fallback: T | null = null): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body.data ?? fallback) as T;
  }
  return body as T;
}

function rows<T>(body: any): T[] {
  const d = data<{ data?: T[] } | T[]>(body, []);
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  return [];
}

/**
 * decimal.js wire format used by the Nest `ClassSerializerInterceptor`:
 *   `{ s: 1|-1, e: exponent, d: number[] }`. Each element of `d` is a
 *   0-7 digit "limb" of the coefficient, NOT a single digit. The full
 *   coefficient is `d.join("")`. The actual value is
 *   `sign × coefficient × 10^(e − coefficient_length + 1)`. Sign is 1
 *   for non-negative numbers, -1 for negative.
 */
function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && 'd' in (value as object)) {
    const d = (value as { d: number[] }).d;
    const e = (value as { e: number }).e;
    const s = (value as { s?: number }).s ?? 1;
    if (!Array.isArray(d) || d.length === 0) return 0;
    const coefficient = d.join('');
    const exp = e - coefficient.length + 1;
    const negative = s === -1;
    const n = Number(`${negative ? '-' : ''}${coefficient}e${exp}`);
    return n;
  }
  return Number(value);
}

describe('Live API (e2e over HTTP)', () => {
  let token: string | null = null;
  let userId: string | null = null;

  beforeAll(async () => {
    const res = await http('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (res.status !== 201) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    token = res.body.data.accessToken;
    userId = res.body.data.user.id;
  });

  it('GET /health', async () => {
    const res = await http('/health');
    expect(res.status).toBe(200);
    expect(res.body.data?.status).toBe('ok');
  });

  it('rejects unauthenticated request to a protected endpoint', async () => {
    const res = await http('/api/gl/accounts');
    expect(res.status).toBe(401);
  });

  it('chart of accounts contains the standard seed codes', async () => {
    const res = await http('/api/gl/accounts', { token });
    expect(res.status).toBe(200);
    const accounts = rows<{ code: string }>(res.body);
    const codes = accounts.map((a) => a.code);
    for (const c of ['1000', '1100', '1200', '2000', '4000']) {
      expect(codes).toContain(c);
    }
  });

  it('tax codes are seeded', async () => {
    const res = await http('/api/gl/tax-codes', { token });
    expect(res.status).toBe(200);
    const codes = rows<unknown>(res.body);
    expect(codes.length).toBeGreaterThanOrEqual(4);
  });

  it('dashboard summary returns KPIs', async () => {
    const res = await http('/api/dashboard/summary', { token });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.kpis || res.body.data.cashPosition).toBeDefined();
  });

  it('runs a full AR sales cycle', async () => {
    const stamp = Date.now();
    const customer = await http('/api/ar/customers', {
      method: 'POST',
      token,
      body: JSON.stringify({
        code: `C-LIVE-${stamp}`,
        name: 'Live E2E Customer',
        email: `live-${stamp}@test.local`,
        taxId: 'C0000000001',
      }),
    });
    expect(customer.status).toBe(201);
    const customerId = customer.body.data.id;

    const itemsRes = await http('/api/stock/items', { token });
    const items = rows<{ id: string }>(itemsRes.body);
    const item = items[0];
    const taxCodesRes = await http('/api/gl/tax-codes', { token });
    const taxCodes = rows<{ code: string; id: string }>(taxCodesRes.body);
    const taxable = taxCodes.find((t) => t.code === 'SVAT-10')!;

    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const invoice = await http('/api/ar/invoices', {
      method: 'POST',
      token,
      body: JSON.stringify({
        customerId,
        date: today,
        dueDate: due,
        lines: [
          { itemId: item.id, description: 'Live sale line', quantity: 1, unitPrice: 100, taxCodeId: taxable.id },
        ],
      }),
    });
    expect(invoice.status).toBe(201);
    const inv = invoice.body.data;
    expect(inv.number).toMatch(/^INV-\d{5}$/);
    expect(decimalToNumber(inv.total)).toBeCloseTo(110, 2);

    // The AR create endpoint posts the journal synchronously, so we
    // can fetch it immediately. Pull a large page to make sure we see
    // the latest one.
    const journalsRes = await http('/api/gl/journals?pageSize=50', { token });
    const journals = rows<{ reference: string | null; totalCredit: unknown }>(journalsRes.body);
    const j = journals.find((x) => x.reference === inv.number);
    expect(j).toBeDefined();
    expect(decimalToNumber(j!.totalCredit)).toBeCloseTo(110, 2);

    const payment = await http('/api/ar/payments', {
      method: 'POST',
      token,
      body: JSON.stringify({
        customerId,
        date: today,
        amount: 110,
        method: 'BANK',
        applications: [{ invoiceId: inv.id, amount: 110 }],
      }),
    });
    expect(payment.status).toBe(201);
    expect(payment.body.data.number).toMatch(/^RCP-\d{5}$/);
  });

  it('runs a full AP purchase cycle', async () => {
    const stamp = Date.now();
    const supplier = await http('/api/ap/suppliers', {
      method: 'POST',
      token,
      body: JSON.stringify({
        code: `S-LIVE-${stamp}`,
        name: 'Live E2E Supplier',
        email: `live-sup-${stamp}@test.local`,
        taxId: 'S0000000001',
      }),
    });
    expect(supplier.status).toBe(201);
    const supplierId = supplier.body.data.id;

    const itemsRes = await http('/api/stock/items', { token });
    const items = rows<{ id: string }>(itemsRes.body);
    const item = items[0];
    const taxCodesRes = await http('/api/gl/tax-codes', { token });
    const taxCodes = rows<{ code: string; id: string }>(taxCodesRes.body);
    const taxable = taxCodes.find((t) => t.code === 'SVAT-10')!;

    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const bill = await http('/api/ap/invoices', {
      method: 'POST',
      token,
      body: JSON.stringify({
        supplierId: supplierId,
        date: today,
        dueDate: due,
        lines: [
          { itemId: item.id, description: 'Live purchase line', quantity: 2, unitPrice: 25, taxCodeId: taxable.id },
        ],
      }),
    });
    expect(bill.status).toBe(201);
    expect(bill.body.data.number).toMatch(/^SINV-\d{5}$/);
    const billId = bill.body.data.id;

    const payment = await http('/api/ap/payments', {
      method: 'POST',
      token,
      body: JSON.stringify({
        supplierId: supplierId,
        date: today,
        amount: 55,
        method: 'BANK',
        applications: [{ invoiceId: billId, amount: 55 }],
      }),
    });
    expect(payment.status).toBe(201);
    expect(payment.body.data.number).toMatch(/^PAY-\d{5}$/);
  });

  it('credit + debit notes are allocated via the sequence service', async () => {
    const customersRes = await http('/api/ar/customers', { token });
    const customers = rows<{ id: string }>(customersRes.body);
    const suppliersRes = await http('/api/ap/suppliers', { token });
    const suppliers = rows<{ id: string }>(suppliersRes.body);
    const today = new Date().toISOString().slice(0, 10);

    const cn = await http('/api/ar/credit-notes', {
      method: 'POST',
      token,
      body: JSON.stringify({
        customerId: customers[0].id,
        date: today,
        reason: 'Live E2E credit',
        lines: [{ description: 'CN line', quantity: 1, unitPrice: 5 }],
      }),
    });
    expect(cn.status).toBe(201);
    expect(cn.body.data.number).toMatch(/^CN-\d{5}$/);

    const dn = await http('/api/ap/debit-notes', {
      method: 'POST',
      token,
      body: JSON.stringify({
        supplierId: suppliers[0].id,
        date: today,
        reason: 'Live E2E debit',
        lines: [{ description: 'DN line', quantity: 1, unitPrice: 5 }],
      }),
    });
    expect(dn.status).toBe(201);
    expect(dn.body.data.number).toMatch(/^DN-\d{5}$/);
  });

  it('reports endpoints return structured payloads', async () => {
    const pnl = await http('/api/reports/pnl', { token });
    expect(pnl.status).toBe(200);
    expect(pnl.body.data).toHaveProperty('revenue');
    const bs = await http('/api/reports/balance-sheet', { token });
    expect(bs.status).toBe(200);
    expect(bs.body.data).toHaveProperty('assets');
    const ar = await http('/api/reports/ar-aging', { token });
    expect(ar.status).toBe(200);
    expect(Array.isArray(ar.body.data?.rows)).toBe(true);
    const ap = await http('/api/reports/ap-aging', { token });
    expect(ap.status).toBe(200);
    expect(Array.isArray(ap.body.data?.rows)).toBe(true);
  });

  it('audit log captures writes from the previous tests', async () => {
    const res = await http('/api/audit-log', { token });
    expect(res.status).toBe(200);
    const entries = rows<{ action: string }>(res.body);
    expect(entries.length).toBeGreaterThan(0);
    const actions = new Set(entries.map((l) => l.action));
    expect(actions.has('CREATE')).toBe(true);
  });

  it('bank reconciliation computes opening + GL balance + difference', async () => {
    const list = await http('/api/bank-accounts', { token });
    if (rows<{ id: string }>(list.body).length === 0) {
      const created = await http('/api/bank-accounts', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: 'Live E2E Bank', accountNumber: '4321', glAccountCode: '1100' }),
      });
      expect([200, 201]).toContain(created.status);
    }
    const refreshed = await http('/api/bank-accounts', { token });
    const bank = rows<{ id: string }>(refreshed.body)[0];
    const recon = await http(`/api/bank-accounts/${bank.id}/reconciliation?statementBalance=0`, { token });
    expect(recon.status).toBe(200);
    expect(typeof recon.body.data.difference).toBe('number');
  });

  it('CSV export of GL works', async () => {
    const res = await fetch(`${BASE}/api/reports/export/general-ledger.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type') || '';
    expect(ct).toMatch(/text\/csv/);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });

  it('admin user list is non-empty', async () => {
    if (!userId) throw new Error('no user');
    const res = await http('/api/auth/users', { token });
    expect(res.status).toBe(200);
    const users = data<Array<{ id: string; role: string }>>(res.body, []);
    expect(users.find((u) => u.id === userId)).toBeDefined();
  });
});
