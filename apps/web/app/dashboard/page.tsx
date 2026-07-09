'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Receipt, Package, BarChart3, FileCheck2, ShoppingCart } from 'lucide-react';
import { api } from '../../lib/api';
import type { DashboardSummary } from '../../lib/api';

function Card({ title, value, hint, accent }: { title: string; value: string; hint?: string; accent?: 'good' | 'warn' | 'bad' }) {
  const ring = accent === 'good' ? 'ring-emerald-100' : accent === 'warn' ? 'ring-amber-100' : accent === 'bad' ? 'ring-rose-100' : '';
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ring-1 ${ring}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function fmt(n: number): string {
  return (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 });
}
function QuickAction({ href, icon: Icon, label, hint }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; hint?: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/30"
    >
      <div className="rounded-md bg-brand-100 p-2 text-brand-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </Link>
  );
}
export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard(),
  });

  if (isLoading) return <p className="p-8 text-slate-500">Loading dashboard…</p>;
  if (error) return <p className="p-8 text-red-600">Failed to load: {(error as Error).message}</p>;
  const d = data as DashboardSummary;
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">Real-time view of your financials.</p>
        </div>
        <a href="/reports" className="text-sm text-brand-700 hover:underline">View full reports →</a>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card title="Cash" value={fmt(d.cashPosition)} accent={d.cashPosition >= 0 ? 'good' : 'bad'} hint="MYR" />
        <Card title="AR Outstanding" value={fmt(d.arOutstanding)} accent={d.arOutstanding > 50000 ? 'warn' : 'good'} />
        <Card title="AP Outstanding" value={fmt(d.apOutstanding)} />
        <Card title="Inventory" value={fmt(d.inventoryValue)} hint="at cost" />
        <Card title="Revenue MTD" value={fmt(d.revenueMtd)} accent="good" />
        <Card title="Expenses MTD" value={fmt(d.expenseMtd)} accent="warn" />
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <QuickAction href="/receivables" icon={ArrowDownLeft} label="New invoice" hint="AR customer billing" />
          <QuickAction href="/payables" icon={ArrowUpRight} label="Record bill" hint="AP supplier bill" />
          <QuickAction href="/sales" icon={ShoppingCart} label="Sales order" hint="Pre-sales workflow" />
          <QuickAction href="/purchase" icon={Receipt} label="Purchase order" hint="Procurement" />
          <QuickAction href="/stock" icon={Package} label="Manage items" hint="SKUs and pricing" />
          <QuickAction href="/einvoice/submissions" icon={FileCheck2} label="Submit e-Invoice" hint="LHDNM MyInvois" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Top Customers (by outstanding)</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Customer</th><th className="text-right">Outstanding</th></tr>
            </thead>
            <tbody>
              {d.topCustomers.length === 0 && (
                <tr><td colSpan={2} className="py-3 text-slate-400">No customers yet.</td></tr>
              )}
              {d.topCustomers.map((c) => (
                <tr key={c.customerId} className="border-t">
                  <td className="py-2">{c.name}</td>
                  <td className="text-right tabular-nums">{fmt(c.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Low Stock Items</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Item</th><th className="text-right">On Hand</th><th className="text-right">Reorder At</th></tr>
            </thead>
            <tbody>
              {d.topItems.length === 0 && (
                <tr><td colSpan={3} className="py-3 text-slate-400">All items above reorder level.</td></tr>
              )}
              {d.topItems.map((i) => (
                <tr key={i.itemId} className="border-t">
                  <td className="py-2">{i.name}</td>
                  <td className="text-right tabular-nums">{i.onHand}</td>
                  <td className="text-right tabular-nums text-slate-500">{i.reorderLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Recent Invoices</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Number</th>
                <th>Customer</th>
                <th>Date</th>
                <th className="text-right">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.recentInvoices.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-slate-400">No invoices yet — create one in Sales.</td></tr>
              )}
              {d.recentInvoices.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="py-2">
                    <a href={`/receivables/${i.id}`} className="text-brand-700 hover:underline">{i.number}</a>
                  </td>
                  <td>{i.customerName}</td>
                  <td className="text-slate-500">{i.date}</td>
                  <td className="text-right tabular-nums">{fmt(i.total)}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs ${i.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">MyInvois Status</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card title="Pending Submissions" value={String(d.einvoicePending ?? 0)} accent={d.einvoicePending ? 'warn' : 'good'} />
            <Card title="Valid Documents" value={String(d.einvoiceValid ?? 0)} accent="good" />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            LHDNM e-invoice integration. Submit invoices from the receivables page or via the e-Invoice module.
          </p>
          <Link
            href="/einvoice/submissions"
            className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
          >
            <FileCheck2 className="h-3.5 w-3.5" /> Open submissions dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}