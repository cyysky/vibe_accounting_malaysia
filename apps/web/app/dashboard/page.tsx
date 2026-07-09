'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { DashboardSummary } from '@account/shared';

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard(),
  });

  if (isLoading) return <p>Loading dashboard…</p>;
  if (error) return <p className="text-red-600">Failed to load: {(error as Error).message}</p>;
  const d = data as DashboardSummary;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: 'currency', currency: 'MYR' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card title="Cash Position" value={fmt(d.cashPosition)} />
        <Card title="AR Outstanding" value={fmt(d.arOutstanding)} />
        <Card title="AP Outstanding" value={fmt(d.apOutstanding)} />
        <Card title="Revenue (MTD)" value={fmt(d.revenueMtd)} />
        <Card title="Expenses (MTD)" value={fmt(d.expenseMtd)} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Top Customers</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Customer</th><th>Outstanding</th></tr>
            </thead>
            <tbody>
              {d.topCustomers.map((c) => (
                <tr key={c.customerId} className="border-t">
                  <td className="py-2">{c.name}</td>
                  <td>{fmt(c.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Top Items (On Hand)</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Item</th><th>Qty</th></tr>
            </thead>
            <tbody>
              {d.topItems.map((i) => (
                <tr key={i.itemId} className="border-t">
                  <td className="py-2">{i.name}</td>
                  <td>{i.soldQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
