"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const fmt = (n: number | undefined) =>
  (Number(n ?? 0)).toLocaleString("en-MY", { style: "currency", currency: "MYR" });

export default function BankReconciliationPage() {
  const banks = useQuery({ queryKey: ["bankAccounts"], queryFn: () => api.bankAccounts() });
  const first = banks.data?.[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const bankId = selectedId ?? first?.id ?? null;

  const rec = useQuery({
    queryKey: ["bankReconciliation", bankId],
    queryFn: () => (bankId ? api.bankReconciliation(bankId) : Promise.resolve(null)),
    enabled: !!bankId,
  });

  const data = rec.data;
  const reconciled = data ? Math.abs(data.difference) < 0.01 : false;

  return (
    <div>
      <PageHeader
        title="Bank Reconciliation"
        description="Compare your bank statement balance with the linked GL account."
        breadcrumbs={[{ label: "Reports" }, { label: "Bank Reconciliation" }]}
        actions={
          <>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={bankId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {(banks.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.currency})
                </option>
              ))}
              {(banks.data ?? []).length === 0 && <option value="">No bank accounts</option>}
            </select>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => rec.refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </>
        }
      />

      {!bankId ? (
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-slate-500">
          Create a bank account first under Settings &rarr; Bank Accounts.
        </div>
      ) : rec.isLoading ? (
        <p className="text-sm text-slate-500">Loading reconciliation…</p>
      ) : !data ? (
        <p className="text-sm text-rose-600">No data.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
                <Landmark className="h-4 w-4 text-sky-600" /> Opening balance
              </div>
              <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(data.openingBalance)}</div>
              <div className="mt-1 text-xs text-slate-500">GL {data.glAccount?.code ?? "?"}</div>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="text-xs uppercase text-slate-500">GL ledger balance</div>
              <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(data.glBalance)}</div>
              <div className="mt-1 text-xs text-slate-500">{data.lines.length} recent lines</div>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="text-xs uppercase text-slate-500">Statement balance</div>
              <input
                type="number"
                step="0.01"
                className="mt-2 w-full rounded border px-2 py-1 text-right text-lg font-semibold tabular-nums"
                value={data.statementBalance}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (data) {
                    (data as { statementBalance: number }).statementBalance = v;
                    (data as { difference: number }).difference = data.glBalance - v;
                  }
                }}
              />
              <div className="mt-1 text-xs text-slate-500">Type your bank&apos;s closing balance.</div>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="text-xs uppercase text-slate-500">Difference</div>
              <div className={`mt-2 text-xl font-semibold tabular-nums ${reconciled ? "text-emerald-700" : "text-rose-700"}`}>
                {fmt(data.difference)}
              </div>
              <div className="mt-1">
                {reconciled ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Reconciled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-700">
                    <AlertCircle className="h-3 w-3" /> Out of balance
                  </span>
                )}
              </div>
            </div>
          </div>

          <section className="mt-6">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Recent GL activity</h2>
              {data.glAccount && <StatusBadge status="POSTED" />}
            </div>
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Journal</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                        No activity on this GL account yet.
                      </td>
                    </tr>
                  ) : (
                    data.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs">{l.date}</td>
                        <td className="px-3 py-2 font-mono text-xs">{l.journalNumber}</td>
                        <td className="px-3 py-2">{l.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(l.debit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(l.credit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-xs text-slate-500">
            Tip: When the difference is zero, your GL and bank statement agree. Investigate any
            outstanding cheques, deposits in transit or bank fees to reconcile.
          </p>
        </>
      )}
    </div>
  );
}
