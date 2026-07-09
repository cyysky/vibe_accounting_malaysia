#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 * Drives the API at http://localhost:8080 with HTTP requests to confirm
 * login + dashboard + a CRUD round-trip on customers + a few essentials.
 *
 * Exits non-zero on the first failure.
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

async function unwrap(json, path) {
  // Strip the {data: ...} envelope added by TransformInterceptor.
  if (json && typeof json === 'object' && 'data' in json) return json.data;
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
  const auth = await unwrap(authRaw, 'login');
  if (!auth?.accessToken) {
    console.error('  ! no token, aborting');
    process.exit(1);
  }
  const token = auth.accessToken;

  step('dashboard');
  const dash = await expect('GET /api/dashboard/summary', () => req('GET', '/api/dashboard/summary', token));
  const dashData = await unwrap(dash, 'dashboard');
  if (typeof dashData?.cashPosition !== 'number') console.warn('  ! dashboard cashPosition not numeric');

  step('chart of accounts');
  const accounts = await expect('GET /api/gl/accounts', () => req('GET', '/api/gl/accounts', token));
  const accData = await unwrap(accounts, 'gl/accounts');
  if (!Array.isArray(accData) || accData.length < 5) {
    console.warn(`  ! only ${accData?.length ?? 0} accounts seeded (expected 5+)`);
  }

  step('customer CRUD');
  const uniqueCode = `SMOKE-${Date.now()}`;
  const created = await expect('POST /api/ar/customers', () =>
    req('POST', '/api/ar/customers', token, { code: uniqueCode, name: 'Smoke Test Customer', country: 'MY', currency: 'MYR' }),
  );
  const createdData = await unwrap(created, 'ar/customers');
  if (createdData?.id) {
    await expect('PUT /api/ar/customers/:id', () =>
      req('PUT', `/api/ar/customers/${createdData.id}`, token, { name: 'Smoke Test Updated' }),
    );
    await expect('DELETE /api/ar/customers/:id', () => req('DELETE', `/api/ar/customers/${createdData.id}`, token));
  }

  step('reports');
  await expect('GET /api/reports/pnl', () => req('GET', '/api/reports/pnl', token));
  await expect('GET /api/reports/balance-sheet', () => req('GET', '/api/reports/balance-sheet', token));

  step('items');
  const items = await expect('GET /api/stock/items', () => req('GET', '/api/stock/items', token));
  const itemsData = await unwrap(items, 'stock/items');
  if (!Array.isArray(itemsData) || itemsData.length < 3) {
    console.warn(`  ! only ${itemsData?.length ?? 0} items seeded (expected 3+)`);
  }

  step('einvoice configs');
  await expect('GET /api/einvoice/configs', () => req('GET', '/api/einvoice/configs', token));

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
