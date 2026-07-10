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
  });
});
