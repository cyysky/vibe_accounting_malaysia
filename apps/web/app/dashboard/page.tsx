"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowDownLeft, ArrowUpRight, Receipt, Package, BarChart3, FileCheck2,
  ShoppingCart, ShoppingBag, Wallet, FileMinus2, FilePlus2, Repeat, Activity,
} from "lucide-react";
import { api } from "../../lib/api";
import type { DashboardSummary } from "../../lib/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";

function Card({ title, value, hint, accent }: { title: string; value: string; hint?: string; accent?: "good" | "warn" | "bad" }) {
  const ring = accent === "good" ? "ring-emerald-100" : accent === "warn" ? "ring-amber-100" : accent === "bad" ? "ring-rose-100" : "";
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ring-1 ${ring}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function fmt(n: number): string {
  return (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });
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
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(),
  });
  const auditQ = useQuery({ queryKey: ["audit-dashboard"], queryFn: () => api.auditLog(15) });
  const cashQ = useQuery({
    queryKey: ["dashboard-cash-flow"],
    queryFn: () => api.cashFlow({}),
  });
  const cash = cashQ.data as
    | { operating: number; investing: number; financing: number; net: number }
    | undefined;

  if (isLoading) return <p className="p-8 text-slate-500">Loading dashboard…</p>;
  if (error) return <p className="p-8 text-red-600">Failed to load: {(error as Error).message}</p>;
  const d = data as DashboardSummary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Real-time view of your financials."
        actions={<Link href="/reports" className="text-sm text-brand-700 hover:underline">View full reports →</Link>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card title="Cash" value={fmt(d.cashPosition)} accent={d.cashPosition >= 0 ? "good" : "bad"} hint="MYR" />
        <Card title="AR Outstanding" value={fmt(d.arOutstanding)} accent={d.arOutstanding > 50000 ? "warn" : "good"} />
        <Card title="AP Outstanding" value={fmt(d.apOutstanding)} />
        <Card title="Inventory" value={fmt(d.inventoryValue)} hint="at cost" />
        <Card title="Revenue MTD" value={fmt(d.revenueMtd)} accent="good" />
        <Card title="Expenses MTD" value={fmt(d.expenseMtd)} accent="warn" />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <QuickAction href="/receivables" icon={ArrowDownLeft} label="New invoice" hint="AR customer billing" />
          <QuickAction href="/payables" icon={ArrowUpRight} label="Record bill" hint="AP supplier bill" />
          <QuickAction href="/sales" icon={ShoppingCart} label="Sales order" hint="Pre-sales workflow" />
          <QuickAction href="/purchase" icon={ShoppingBag} label="Purchase order" hint="Procurement" />
          <QuickAction href="/stock" icon={Package} label="Manage items" hint="SKUs and pricing" />
          <QuickAction href="/einvoice/submissions" icon={FileCheck2} label="Submit e-Invoice" hint="LHDNM MyInvois" />
          <QuickAction href="/receivables/payments" icon={Wallet} label="Customer payment" hint="Receipts & application" />
          <QuickAction href="/payables/payments" icon={Wallet} label="Supplier payment" hint="Disbursements" />
          <QuickAction href="/receivables/credit-notes" icon={FileMinus2} label="Credit note" hint="Issue refund / adjust" />
          <QuickAction href="/payables/debit-notes" icon={FilePlus2} label="Debit note" hint="Additional supplier charge" />
          <QuickAction href="/recurring" icon={Repeat} label="Recurring" hint="Auto invoice templates" />
          <QuickAction href="/audit-log" icon={Activity} label="Activity" hint="Audit log" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent invoices</h2>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Number</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.recentInvoices.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={`/receivables/${i.id}`} className="font-mono text-xs text-brand-700 hover:underline">{i.number}</Link>
                    </td>
                    <td className="px-3 py-2">{i.customerName}</td>
                    <td className="px-3 py-2">{i.date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(i.total))}</td>
                    <td className="px-3 py-2"><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
                {d.recentInvoices.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No invoices yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Top customers</h2>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {d.topCustomers.map((c) => (
                  <tr key={c.customerId} className="border-t">
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(c.balance))}</td>
                  </tr>
                ))}
                {d.topCustomers.length === 0 && (
                  <tr><td colSpan={2} className="px-3 py-6 text-center text-slate-500">No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Low stock</h2>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">On hand</th>
                  <th className="px-3 py-2 text-right">Reorder at</th>
                </tr>
              </thead>
              <tbody>
                {d.topItems.map((i) => (
                  <tr key={i.itemId} className="border-t">
                    <td className="px-3 py-2">{i.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(i.onHand).toLocaleString("en-MY")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(i.reorderLevel).toLocaleString("en-MY")}</td>
                  </tr>
                ))}
                {d.topItems.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">All stock levels healthy.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recent activity</h2>
            <Link href="/audit-log" className="text-xs text-brand-700 hover:underline">All activity →</Link>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            {auditQ.isLoading && <p className="text-xs text-slate-400">Loading activity…</p>}
            {auditQ.error && <p className="text-xs text-rose-600">Failed to load: {(auditQ.error as Error).message}</p>}
            {(auditQ.data ?? []).length === 0 && !auditQ.isLoading && (
              <p className="text-xs text-slate-500">No recorded activity yet.</p>
            )}
            <ol className="space-y-2">
              {(auditQ.data ?? []).slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-start gap-2 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                  <div className="mt-1">
                    <StatusBadge status={e.action === 'CREATE' ? 'ISSUED' : e.action === 'SUBMIT' ? 'VALID' : e.action === 'CANCEL' ? 'CANCELLED' : 'DRAFT'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs">
                      <span className="font-semibold text-slate-700">{e.action}</span>
                      <span className="ml-1 text-slate-500">{e.entity}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {e.user?.name ?? e.user?.email ?? 'system'} • {new Date(e.createdAt).toLocaleString('en-MY')}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">e-Invoice status</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card title="Pending" value={String(d.einvoicePending ?? 0)} accent="warn" hint="Awaiting MyInvois validation" />
            <Card title="Valid" value={String(d.einvoiceValid ?? 0)} accent="good" hint="Successfully validated" />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Cash flow (period to date)</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card title="Operating" value={fmt(cash?.operating ?? 0)} accent={(cash?.operating ?? 0) >= 0 ? 'good' : 'bad'} hint="Revenue - Expenses" />
            <Card title="Investing" value={fmt(cash?.investing ?? 0)} accent={(cash?.investing ?? 0) >= 0 ? 'good' : 'bad'} hint="Asset movements" />
            <Card title="Financing" value={fmt(cash?.financing ?? 0)} accent={(cash?.financing ?? 0) >= 0 ? 'good' : 'bad'} hint="Liability / equity" />
            <Card title="Net cash flow" value={fmt(cash?.net ?? 0)} accent={(cash?.net ?? 0) >= 0 ? 'good' : 'warn'} hint="Operating + investing + financing" />
          </div>
          {cashQ.error && (
            <p className="mt-2 text-xs text-rose-600">Failed to load cash flow: {(cashQ.error as Error).message}</p>
          )}
        </section>
      </div>
    </div>
  );
}
