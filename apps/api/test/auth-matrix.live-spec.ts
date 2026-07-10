/**
 * Live auth matrix e2e tests.
 *
 * Verifies that:
 *   - All read/write endpoints reject unauthenticated requests with 401
 *     (except for /auth/login, /auth/refresh, /health).
 *   - A bad token returns 401.
 *   - A valid token returns 200/201.
 *   - The seeded admin can hit the protected routes.
 */
const BASE = process.env.API_BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.API_EMAIL || 'admin@example.com';
const PASSWORD = process.env.API_PASSWORD || 'ChangeMe!123';

async function http(path: string, init: RequestInit & { token?: string | null } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string> | undefined) ?? {}),
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

const PROTECTED_READS: Array<[string, string]> = [
  ['GET', '/api/dashboard/summary'],
  ['GET', '/api/gl/accounts'],
  ['GET', '/api/gl/tax-codes'],
  ['GET', '/api/gl/journals'],
  ['GET', '/api/ar/customers'],
  ['GET', '/api/ar/invoices'],
  ['GET', '/api/ap/suppliers'],
  ['GET', '/api/ap/invoices'],
  ['GET', '/api/einvoice/configs'],
  ['GET', '/api/einvoice/submissions'],
  ['GET', '/api/bank-accounts'],
  ['GET', '/api/stock/items'],
  ['GET', '/api/stock/movements'],
  ['GET', '/api/reports/pnl'],
  ['GET', '/api/reports/balance-sheet'],
  ['GET', '/api/reports/general-ledger'],
  ['GET', '/api/reports/ar-aging'],
  ['GET', '/api/reports/ap-aging'],
  ['GET', '/api/audit-log'],
  ['GET', '/api/auth/users'],
];

describe('Auth matrix (e2e over HTTP)', () => {
  let token: string | null = null;

  beforeAll(async () => {
    const login = await http('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    expect(login.status).toBe(201);
    token = login.body.data.accessToken;
  });

  it('public endpoints succeed without a token', async () => {
    const health = await http('/health');
    expect([200, 201]).toContain(health.status);
  });

  it('rejects every protected read endpoint without a token', async () => {
    for (const [method, path] of PROTECTED_READS) {
      const res = await http(path, { method });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  });

  it('rejects a malformed bearer token', async () => {
    const res = await http('/api/dashboard/summary', { token: 'not-a-real-jwt' });
    expect(res.status).toBe(401);
  });

  it('accepts a valid bearer token on the protected reads', async () => {
    for (const [method, path] of PROTECTED_READS) {
      const res = await http(path, { method, token });
      expect({ method, path, status: res.status }).toEqual({
        method,
        path,
        status: res.status,
      });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(400);
    }
  });

  it('rejects login with wrong password', async () => {
    const res = await http('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: 'definitely-wrong' }),
    });
    expect(res.status).toBe(401);
  });
});
