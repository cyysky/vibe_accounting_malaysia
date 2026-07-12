"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Wallet, Scale, AlertCircle, FileText, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";
import type { AgingRow, GLLine, GLSummary } from "../../lib/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";

const fmt = (n: number | string | undefined) => (Number(n ?? 0)).toLocaleString("en-MY", { style: "currency", currency: "MYR" });
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export default function ReportsPage() {
  const pnl = useQuery({ queryKey: ["pnl"], queryFn: () => api.pnl() });
  const bs = useQuery({ queryKey: ["bs"], queryFn: () => api.balanceSheet() });

  const [arAsOf, setArAsOf] = useState(today());
  const [apAsOf, setApAsOf] = useState(today());
  const [glFrom, setGlFrom] = useState(monthStart());
  const [glTo, setGlTo] = useState(today());

  const arAging = useQuery({ queryKey: ["ar-aging", arAsOf], queryFn: () => api.arAging(arAsOf) });
  const apAging = useQuery({ queryKey: ["ap-aging", apAsOf], queryFn: () => api.apAging(apAsOf) });
  const gl = useQuery({ queryKey: ["gl", glFrom, glTo], queryFn: () => api.generalLedger(glFrom, glTo) });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        description="P&L, balance sheet, AR/AP aging and general ledger."
        actions={<>
          <Button variant="secondary" size="sm" onClick={() => api.exportCsv("/reports/export/profit-and-loss.csv")}>
            <Download className="h-3.5 w-3.5" /> P&amp;L CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => api.exportCsv("/reports/export/balance-sheet.csv")}>
            <Download className="h-3.5 w-3.5" /> BS CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => api.exportCsv(`/reports/export/ar-aging.csv?asOf=${arAsOf}`)}>
            <Download className="h-3.5 w-3.5" /> AR CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => api.exportCsv(`/reports/export/ap-aging.csv?asOf=${apAsOf}`)}>
            <Download className="h-3.5 w-3.5" /> AP CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => api.exportCsv(`/reports/export/general-ledger.csv?from=${glFrom}&to=${glTo}`)}>
            <Download className="h-3.5 w-3.5" /> GL CSV
          </Button>
        </>
      }
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Profit &amp; Loss</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><TrendingUp className="h-4 w-4 text-emerald-600" /> Revenue</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{fmt(pnl.data?.revenue)}</div>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><TrendingDown className="h-4 w-4 text-rose-600" /> Expenses</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{fmt(pnl.data?.expenses)}</div>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><Wallet className="h-4 w-4 text-brand-600" /> Net Income</div>
            <div className={`mt-2 text-2xl font-semibold tabular-nums ${(pnl.data?.netIncome ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {fmt(pnl.data?.netIncome)}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Balance Sheet</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><Scale className="h-4 w-4 text-sky-600" /> Assets</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(bs.data?.assets)}</div>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="text-xs uppercase text-slate-500">Liabilities</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(bs.data?.liabilities)}</div>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="text-xs uppercase text-slate-500">Equity</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(bs.data?.equity)}</div>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="text-xs uppercase text-slate-500">Balanced</div>
            <div className="mt-2"><StatusBadge status={bs.data?.balanced ? "ISSUED" : "INVALID"} /></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AgingTable title="AR Aging (Receivables)" asOf={arAsOf} setAsOf={setArAsOf} data={arAging.data} nameKey="customerName" entity="customer" />
        <AgingTable title="AP Aging (Payables)" asOf={apAsOf} setAsOf={setApAsOf} data={apAging.data} nameKey="supplierName" entity="supplier" />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">General Ledger</h2>
        <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3 text-sm">
          <label className="flex items-center gap-2">From <input type="date" className="rounded border px-2 py-1" value={glFrom} onChange={(e) => setGlFrom(e.target.value)} /></label>
          <label className="flex items-center gap-2">To <input type="date" className="rounded border px-2 py-1" value={glTo} onChange={(e) => setGlTo(e.target.value)} /></label>
          <span className="ml-auto text-xs text-slate-500">{(gl.data?.lines ?? []).length} lines • {(gl.data?.accounts ?? []).length} accounts</span>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Journal</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-right">Running</th>
              </tr>
            </thead>
            <tbody>
              {(gl.data?.lines ?? []).slice(0, 200).map((l: GLLine, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2">{l.date}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.journalNumber}</td>
                  <td className="px-3 py-2"><span className="font-mono text-xs text-slate-500">{l.accountCode}</span> {l.accountName}</td>
                  <td className="px-3 py-2 text-slate-600">{l.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(l.debit) ? fmt(l.debit) : ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(l.credit) ? fmt(l.credit) : ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmt(l.runningBalance)}</td>
                </tr>
              ))}
              {(gl.data?.lines ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No journal entries in range.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(gl.data?.accounts ?? []).length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Opening</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {(gl.data?.accounts ?? []).map((a: GLSummary) => (
                  <tr key={a.accountId} className="border-t">
                    <td className="px-3 py-2"><span className="font-mono text-xs text-slate-500">{a.accountCode}</span> {a.accountName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(a.opening)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(a.debit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(a.credit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(a.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AgingTable({
  title, asOf, setAsOf, data, nameKey, entity,
}: {
  title: string;
  asOf: string;
  setAsOf: (s: string) => void;
  data: { asOf: string; rows: AgingRow[]; totals: AgingRow["buckets"] } | undefined;
  nameKey: "customerName" | "supplierName";
  entity: "customer" | "supplier";
}) {
  const filterParam = entity === "customer" ? "customerId" : "supplierId";
  const listHref = entity === "customer" ? "/receivables" : "/payables";
  const detailHref = entity === "customer" ? "/receivables/" : "/payables/";
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <label className="text-xs text-slate-500">As of <input type="date" className="ml-1 rounded border px-2 py-1" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">1-30</th>
              <th className="px-3 py-2 text-right">31-60</th>
              <th className="px-3 py-2 text-right">61-90</th>
              <th className="px-3 py-2 text-right">90+</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((r, idx) => {
              const name = (r as unknown as Record<string, unknown>)[nameKey] as string;
              const entityId = (r as unknown as Record<string, unknown>)[entity === "customer" ? "customerId" : "supplierId"] as string | undefined;
              const entityHref = entityId ? `${listHref}?${filterParam}=${encodeURIComponent(entityId)}` : null;
              const worst = (r.invoices ?? []).filter((i) => i.daysOverdue >= 90)[0] ?? (r.invoices ?? []).slice().sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
              return (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2">
                    {entityHref ? (
                      <Link href={entityHref} className="font-medium text-brand-700 hover:underline">{name}</Link>
                    ) : (
                      <span>{name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.buckets.current)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.buckets.d1_30)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.buckets.d31_60)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.buckets.d61_90)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {worst && worst.daysOverdue >= 90 ? (
                      <Link href={detailHref + worst.id} className="inline-flex items-center gap-1 text-rose-700 hover:underline">
                        {fmt(r.buckets.d90_plus)} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-rose-700">{fmt(r.buckets.d90_plus)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(r.buckets.total)}</td>
                </tr>
              );
            })}
            {(data?.rows ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No outstanding balances.</td></tr>
            )}
          </tbody>
          <tfoot className="border-t bg-slate-50 font-medium">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(data?.totals?.current)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(data?.totals?.d1_30)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(data?.totals?.d31_60)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(data?.totals?.d61_90)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-rose-700">{fmt(data?.totals?.d90_plus)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(data?.totals?.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
