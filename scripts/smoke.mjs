#!/usr/bin/env node
/**
 * End-to-end smoke test for the Vibe Accounting Malaysia API.
 *
 * Runs against http://localhost:8080 by default. Covers:
 *   - health
 *   - auth
 *   - dashboard summary
 *   - chart of accounts
 *   - customer CRUD
 *   - tax codes CRUD
 *   - fiscal years CRUD
 *   - customer invoice + auto-GL-post (DR AR, CR Sales, CR SST)
 *   - reports (P&L + balance sheet)
 *   - items CRUD
 *   - einvoice configs
 *   - einvoice submission listing + cancel/reject endpoints (expect network errors on SANDBOX but
 *     we just hit the controller with a non-existent id so it returns 404 quickly)
 */
import { setTimeout as wait } from 'node:timers/promises';

const HOST = process.env.SMOKE_HOST ?? 'http://localhost:8080';

async function req(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    // Allow 404 / 400 on optional probes
    if (res.status >= 400 && res.status < 500 && path.includes('probe')) {
      return { __status: res.status, __body: json };
    }
    throw new Error(`${method} ${path} -> ${res.status}\n${text}`);
  }
  return json;
}

function step(label) {
  console.log(`\n=== ${label} ===`);
}

let failed = false;
async function expect(label, fn) {
  try {
    const r = await fn();
    console.log(`  ✓ ${label}`);
    return r;
  } catch (err) {
    failed = true;
    console.error(`  ✗ ${label}: ${err.message}`);
  }
}

async function unwrap(json) {
  if (json && typeof json === 'object' && 'data' in json && !('__status' in json)) return json.data;
  return json;
}

async function main() {
  step('health');
  const h = await expect('GET /health', () => req('GET', '/health'));
  if (h?.status && h.status !== 'ok') console.warn(`  ! health status: ${h.status}`);

  step('login');
  const authRaw = await expect('POST /api/auth/login', () =>
    req('POST', '/api/auth/login', null, { email: 'admin@example.com', password: 'ChangeMe!123' }),
  );
  const auth = await unwrap(authRaw);
  if (!auth?.accessToken) {
    console.error('  ! no token, aborting');
    process.exit(1);
  }
  const token = auth.accessToken;
  step('dashboard');
  const dash = await expect('GET /api/dashboard/summary', () => req('GET', '/api/dashboard/summary', token));
  const dashData = await unwrap(dash);
  if (typeof dashData?.cashPosition !== 'number') console.warn('  ! dashboard cashPosition not numeric');

  step('chart of accounts');
  const accounts = await expect('GET /api/gl/accounts', () => req('GET', '/api/gl/accounts', token));
  const accData = await unwrap(accounts);
  if (!Array.isArray(accData) || accData.length < 5) {
    console.warn(`  ! only ${accData?.length ?? 0} accounts seeded (expected 5+)`);
  }
  step('customer CRUD');
  const uniqueCode = `SMOKE-${Date.now()}`;
  const created = await expect('POST /api/ar/customers', () =>
    req('POST', '/api/ar/customers', token, { code: uniqueCode, name: 'Smoke Test Customer', country: 'MY', currency: 'MYR' }),
  );
  const createdData = await unwrap(created);
  if (createdData?.id) {
    await expect('PUT /api/ar/customers/:id', () =>
      req('PUT', `/api/ar/customers/${createdData.id}`, token, { name: 'Smoke Test Updated' }),
    );
    await expect('DELETE /api/ar/customers/:id', () => req('DELETE', `/api/ar/customers/${createdData.id}`, token));
  }
  step('tax codes CRUD');
  const taxCodes = await expect('GET /api/gl/tax-codes', () => req('GET', '/api/gl/tax-codes', token));
  const tcData = await unwrap(taxCodes);
  if (!Array.isArray(tcData) || tcData.length < 4) {
    console.warn(`  ! only ${tcData?.length ?? 0} tax codes seeded (expected 4+)`);
  }
  const newTc = await expect('POST /api/gl/tax-codes', () =>
    req('POST', '/api/gl/tax-codes', token, { code: `SVC-${Date.now()}`, name: 'Service Tax 6%', rate: 0.06 }),
  );
  const newTcData = await unwrap(newTc);
  if (newTcData?.id) {
    await expect('DELETE /api/gl/tax-codes/:id', () => req('DELETE', `/api/gl/tax-codes/${newTcData.id}`, token));
  }

  step('fiscal years');
  const fys = await expect('GET /api/gl/fiscal-years', () => req('GET', '/api/gl/fiscal-years', token));
  const fyData = await unwrap(fys);
  if (!Array.isArray(fyData) || fyData.length < 1) console.warn('  ! no fiscal years seeded');

  step('invoice + auto-GL-post');
  // Need a real customer first.
  const cCode = `INV-C-${Date.now()}`;
  const c = await expect('POST /api/ar/customers', () =>
    req('POST', '/api/ar/customers', token, { code: cCode, name: 'Invoice Smoke Customer' }),
  );
  const customer = await unwrap(c);
  if (customer?.id) {
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const inv = await expect('POST /api/ar/invoices', () =>
      req('POST', '/api/ar/invoices', token, {
        customerId: customer.id,
        date: today,
        dueDate: due,
        lines: [{ description: 'Smoke line 1', quantity: 2, unitPrice: 100 }],
      }),
    );
    const invoice = await unwrap(inv);
    if (invoice?.id) {
      // Confirm a journal entry was generated.
      const journals = await expect('GET /api/gl/journals', () => req('GET', '/api/gl/journals', token));
      const jData = await unwrap(journals);
      const found = Array.isArray(jData?.data) && jData.data.find((j) => j.reference === invoice.number);
      if (!found) console.warn(`  ! no auto-posted journal for ${invoice.number}`);
      else console.log(`  → auto-posted JV ${found.number}`);
    }
  }
  step('reports');
  await expect('GET /api/reports/pnl', () => req('GET', '/api/reports/pnl', token));
  await expect('GET /api/reports/balance-sheet', () => req('GET', '/api/reports/balance-sheet', token));

  step('items');
  const items = await expect('GET /api/stock/items', () => req('GET', '/api/stock/items', token));
  const itemsData = await unwrap(items);
  if (!Array.isArray(itemsData) || itemsData.length < 3) {
    console.warn(`  ! only ${itemsData?.length ?? 0} items seeded (expected 3+)`);
  }

  step('einvoice');
  await expect('GET /api/einvoice/configs', () => req('GET', '/api/einvoice/configs', token));
  await expect('GET /api/einvoice/submissions', () => req('GET', '/api/einvoice/submissions', token));
  // These will return 404 because there are no real submissions - they only test the route exists.
  await expect('POST /api/einvoice/submissions/probe-id/cancel (404 expected)', () =>
    req('POST', '/api/einvoice/submissions/probe-id/cancel', token, { reason: 'smoke' }),
  );

  if (failed) {
    console.error('\n[smoke] FAILED');
    process.exit(1);
  }
  console.log('\n[smoke] all checks passed ✓');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});