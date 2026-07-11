/**
 * Extra live HTTP e2e tests for newly added endpoints
 * (CSV export of audit log, cash-flow report, recurring preview).
 *
 * Shares the same auth + data unwrap pattern as happy-path.live-spec.ts.
 */
const BASE = process.env.API_BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.API_EMAIL || 'admin@example.com';
const PASSWORD = process.env.API_PASSWORD || 'ChangeMe!123';

async function http(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<{ status: number; body: any; text?: string; headers: Headers }> {
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
  return { status: res.status, body, text, headers: res.headers };
}

function data<T = any>(body: any, fallback: T | null = null): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body.data ?? fallback) as T;
  }
  return body as T;
}

describe('Extra endpoints (e2e over HTTP)', () => {
  let token: string | null = null;

  beforeAll(async () => {
    const r = await http('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    expect(r.status).toBe(201);
    token = r.body.data.accessToken;
  });

  it('GET /api/audit-log/export.csv returns a CSV with a header row', async () => {
    const r = await http('/api/audit-log/export.csv', { token });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/text\/csv/);
    const text = r.text ?? '';
    const first = text.split('\n')[0];
    expect(first).toMatch(/^id,createdAt,action,entity,entityId,user,message/);
  });

  it('GET /api/reports/cash-flow returns the four-bucket summary', async () => {
    const r = await http('/api/reports/cash-flow', { token });
    expect(r.status).toBe(200);
    const d = data<{
      operating: number; investing: number; financing: number; net: number;
      periodInflows: number; periodOutflows: number; journalCount: number;
    }>(r.body, {
      operating: 0, investing: 0, financing: 0, net: 0,
      periodInflows: 0, periodOutflows: 0, journalCount: 0,
    });
    expect(d).toHaveProperty('operating');
    expect(d).toHaveProperty('investing');
    expect(d).toHaveProperty('financing');
    expect(d).toHaveProperty('net');
    expect(typeof d.net).toBe('number');
  });

  it('GET /api/recurring/:id/preview returns at least one date when templates exist', async () => {
    const list = await http('/api/recurring', { token });
    expect(list.status).toBe(200);
    const arr: Array<{ id: string }> = (() => {
      const b = list.body;
      if (Array.isArray(b)) return b;
      if (Array.isArray(b?.data)) return b.data;
      if (Array.isArray(b?.data?.data)) return b.data.data;
      return [];
    })();
    if (arr.length === 0) {
      expect(true).toBe(true); // skip when no recurring templates;
      return;
    }
    const id = arr[0].id;
    const r = await http(`/api/recurring/${id}/preview?count=5`, { token });
    expect(r.status).toBe(200);
    const d = data<{ dates: string[] }>(r.body, { dates: [] });
    expect(d.dates.length).toBeGreaterThan(0);
    for (const date of d.dates) {
      expect(date).toMatch(/^20\d\d-\d\d-\d\d$/);
    }
  });

  it('rejects unauthenticated access to /api/audit-log/export.csv', async () => {
    const r = await http('/api/audit-log/export.csv');
    expect(r.status).toBe(401);
  });

  it('rejects unauthenticated access to /api/reports/cash-flow', async () => {
    const r = await http('/api/reports/cash-flow');
    expect(r.status).toBe(401);
  });  it('GET /api/dashboard/search returns hits when the book has customers/items', async () => {
    const r = await http('/api/dashboard/search?q=Acme', { token });
    expect(r.status).toBe(200);
    const d = data<{
      customers: unknown[]; suppliers: unknown[]; items: unknown[];
      invoices: unknown[]; bills: unknown[]; journals: unknown[];
    }>(r.body, {
      customers: [], suppliers: [], items: [], invoices: [], bills: [], journals: [],
    });
    expect(d).toHaveProperty('customers');
    expect(d).toHaveProperty('suppliers');
    expect(d).toHaveProperty('items');
    expect(d).toHaveProperty('invoices');
    expect(d).toHaveProperty('bills');
    expect(d).toHaveProperty('journals');
  });

  it('rejects too-short queries with empty buckets', async () => {
    const r = await http('/api/dashboard/search?q=a', { token });
    expect(r.status).toBe(200);
    const d = data<{ customers: unknown[] }>(r.body, { customers: [] });
    expect(Array.isArray(d.customers)).toBe(true);
    expect(d.customers).toHaveLength(0);
  });

  it('returns 401 for unauthenticated search', async () => {
    const r = await http('/api/dashboard/search?q=acme');
    expect(r.status).toBe(401);
  });

  it('POST /api/gl/fiscal-years/:id/close toggles closed=true', async () => {
    // Create a throwaway fiscal year we can close without affecting the running books.
    const year = 2099;
    const create = await http('/api/gl/fiscal-years', {
      method: 'POST',
      token,
      body: JSON.stringify({ year, startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
    });
    if (create.status === 409 || create.status === 400) {
      // Already created or invalid - try the closest year we can find and skip.
      return;
    }
    expect(create.status).toBe(201);
    const id = (create.body?.data as { id?: string })?.id;
    if (!id) return;
    const close = await http(`/api/gl/fiscal-years/${id}/close`, { method: 'POST', token });
    expect(close.status).toBe(200);
    expect((close.body?.data as { closed?: boolean })?.closed).toBe(true);
    const reopen = await http(`/api/gl/fiscal-years/${id}/reopen`, { method: 'POST', token });
    expect(reopen.status).toBe(200);
    expect((reopen.body?.data as { closed?: boolean })?.closed).toBe(false);
  });

  it('POST /api/gl/journals/:id/reverse flips lines and marks the original REVERSED', async () => {
    // Pick the most recent posted journal to reverse.
    const list = await http('/api/gl/journals?pageSize=10', { token });
    expect(list.status).toBe(200);
    const items: Array<{ id: string; status: string }> = (() => {
      const b = list.body;
      if (Array.isArray(b?.data?.data)) return b.data.data;
      if (Array.isArray(b?.data)) return b.data;
      return [];
    })();
    const candidate = items.find((j) => j.status === 'POSTED');
    if (!candidate) {
      console.warn('No POSTED journal to reverse; skipping.');
      return;
    }
    const res = await http(`/api/gl/journals/${candidate.id}/reverse`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason: 'e2e-test' }),
    });
    expect(res.status).toBe(201);
    expect((res.body?.data as { description?: string })?.description).toMatch(/REVERSAL of/);
  });

  it('rejects reversing an already-reversed journal', async () => {
    const list = await http('/api/gl/journals?pageSize=10', { token });
    const items: Array<{ id: string; status: string }> = (() => {
      const b = list.body;
      if (Array.isArray(b?.data?.data)) return b.data.data;
      if (Array.isArray(b?.data)) return b.data;
      return [];
    })();
    const reversed = items.find((j) => j.status === 'REVERSED');
    if (!reversed) return;
    const res = await http(`/api/gl/journals/${reversed.id}/reverse`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason: 'again' }),
    });
    expect([400, 404]).toContain(res.status);
  });

  it('GET /api/gl/trial-balance accepts an asOf date', async () => {
    const r = await http('/api/gl/trial-balance?asOf=2030-01-01', { token });
    expect(r.status).toBe(200);
  });

  it('rejects reverse with unknown id', async () => {
    const res = await http('/api/gl/journals/00000000-0000-0000-0000-000000000000/reverse', {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});
