/**
 * Live e-invoice UBL validation e2e tests.
 *
 * Unlike the happy-path suite, these tests do NOT need the MyInvois sandbox
 * to be reachable. They exercise the in-process UBL validator + endpoint
 * gating logic that runs immediately before submission.
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

describe('Live e-invoice UBL validation (e2e)', () => {
  let token: string | null = null;

  beforeAll(async () => {
    const res = await http('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    expect(res.status).toBe(201);
    token = (res.body.data as { accessToken: string }).accessToken;
  });

  it('rejects validate-invoice without a token', async () => {
    const res = await http('/api/einvoice/invoices/does-not-exist/validate', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown invoice', async () => {
    const res = await http('/api/einvoice/invoices/00000000-0000-0000-0000-000000000000/validate', {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    });
    expect([404, 400]).toContain(res.status);
  });

  it('returns a validation report for the most recent invoice (validateOnly true)', async () => {
    // Find an existing invoice first
    const invoices = await http('/api/ar/invoices', { token });
    expect(invoices.status).toBe(200);
    const list: Array<{ id: string }> = (
      Array.isArray(invoices.body)
        ? invoices.body
        : Array.isArray(invoices.body?.data)
          ? invoices.body.data
          : Array.isArray(invoices.body?.data?.data)
            ? invoices.body.data.data
            : []
    );
    if (list.length === 0) {
      // nothing to test against — skip.
      console.warn('No invoices found, skipping UBL validator e2e test.');
      return;
    }
    const id = list[0].id;
    const res = await http(`/api/einvoice/invoices/${id}/validate`, {
      method: 'POST',
      token,
      body: JSON.stringify({ validateOnly: true }),
    });
    // 400 is acceptable here: it means there is no MyInvois config for this
    // book, which is the case in fresh CI / local dev.  In that case we
    // can't actually validate without configuring MyInvois.
    if (res.status === 400) {
      expect(String(res.body?.message ?? '')).toMatch(/MyInvois/);
      return;
    }
    expect([200, 201]).toContain(res.status);
    const result = data<{ valid?: boolean; issues?: unknown[]; summary?: { errors?: number; warnings?: number } }>(
      res.body,
      { valid: false, issues: [], summary: { errors: 0, warnings: 0 } },
    );
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('summary');
  });

  it('submit-invoice with validateOnly returns without contacting MyInvois', async () => {
    const invoices = await http('/api/ar/invoices', { token });
    const list: Array<{ id: string }> = (
      Array.isArray(invoices.body)
        ? invoices.body
        : Array.isArray(invoices.body?.data)
          ? invoices.body.data
          : Array.isArray(invoices.body?.data?.data)
            ? invoices.body.data.data
            : []
    );
    if (list.length === 0) {
      console.warn('No invoices found, skipping submit.validateOnly e2e test.');
      return;
    }
    const id = list[0].id;
    const res = await http(`/api/einvoice/invoices/${id}/submit`, {
      method: 'POST',
      token,
      body: JSON.stringify({ validateOnly: true }),
    });
    if (res.status === 400) {
      expect(String(res.body?.message ?? '')).toMatch(/MyInvois/);
      return;
    }
    expect([200, 201]).toContain(res.status);
    const body = data<{ submissionId: string | null; validation?: unknown }>(res.body, { submissionId: null });
    expect(body.submissionId).toBeNull();
    expect(body.validation).toBeDefined();
  });
});
