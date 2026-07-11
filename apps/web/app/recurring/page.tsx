"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat, Trash2, Play } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import type { Customer, RecurringInvoice } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { DataTable } from "../../components/ui/DataTable";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";

interface LineDraft {
  description: string;
  quantity: number;
  unitPrice: number;
  taxCodeId?: string;
}

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

function RecurringForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const customersQ = useQuery({ queryKey: ["customers"], queryFn: () => api.customers() });
  const taxCodesQ = useQuery({ queryKey: ["taxCodes"], queryFn: () => api.taxCodes() });
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", quantity: 1, unitPrice: 0 }]);

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof api.createRecurring>[0]) => api.createRecurring(payload),
    onSuccess: () => onSaved(),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New Recurring Invoice Template"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={!customerId || !name || lines.length === 0}
            onClick={() =>
              create.mutate({
                customerId, name, frequency, startDate,
                notes: notes || undefined,
                lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxCodeId: l.taxCodeId })),
              })
            }
          >Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Customer *</div>
          <select className="w-full rounded-md border px-3 py-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select…</option>
            {(customersQ.data ?? []).map((c: Customer) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Template name *</div>
          <input className="w-full rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly retainer" />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Frequency *</div>
          <select className="w-full rounded-md border px-3 py-2" value={frequency} onChange={(e) => setFrequency(e.target.value as never)}>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Start date *</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-1 font-medium text-slate-700">Notes</div>
          <textarea className="w-full rounded-md border px-3 py-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lines</h3>
          <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { description: "", quantity: 1, unitPrice: 0 }])}><Plus className="h-3.5 w-3.5" /> Add line</Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2">Tax</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const tc = (taxCodesQ.data ?? []).find((t) => t.id === l.taxCodeId);
                const sub = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
                const tax = tc ? sub * Number(tc.rate) : 0;
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2"><input className="w-full rounded border px-2 py-1" value={l.description} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} /></td>
                    <td className="px-3 py-2 text-right"><input type="number" className="w-20 rounded border px-2 py-1 text-right" value={l.quantity} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                    <td className="px-3 py-2 text-right"><input type="number" className="w-24 rounded border px-2 py-1 text-right" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, unitPrice: Number(e.target.value) } : x))} /></td>
                    <td className="px-3 py-2">
                      <select className="w-full rounded border px-2 py-1" value={l.taxCodeId ?? ""} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, taxCodeId: e.target.value || undefined } : x))}>
                        <option value="">None</option>
                        {(taxCodesQ.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>{t.code} ({(Number(t.rate) * 100).toFixed(2)}%)</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(sub + tax)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-700" disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default function RecurringPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["recurring"], queryFn: () => api.recurringInvoices() });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteRecurring(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }) });
  const runOne = useMutation({ mutationFn: (id: string) => api.runRecurring(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }) });
  const runDue = useMutation({ mutationFn: () => api.runDueRecurring(), onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }) });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Recurring Invoices"
        description="Templates that automatically generate invoices on a schedule."
        breadcrumbs={[{ label: "Recurring" }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => runDue.mutate()} loading={runDue.isPending}>
              <Play className="h-4 w-4" /> Run due now
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New template
            </Button>
          </>
        }
      />
      <DataTable<RecurringInvoice>
        data={q.data ?? []}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <Repeat className="h-10 w-10" /> No recurring templates yet.
          </div>
        }
        columns={[
          { key: "name", header: "Template", render: (r) => <a href={'/recurring/' + r.id} className="font-medium text-brand-700 hover:underline">{r.name}</a> },
          { key: "customer", header: "Customer", render: (r) => r.customer?.name ?? "-" },
          { key: "frequency", header: "Frequency", render: (r) => <StatusBadge status={r.frequency} /> },
          { key: "nextRun", header: "Next run" },
          { key: "lastRun", header: "Last run", render: (r) => r.lastRunDate ?? "—" },
          { key: "active", header: "Active", render: (r) => r.active ? <StatusBadge status="ISSUED" /> : <StatusBadge status="VOID" /> },
          {
            key: "actions", header: "", align: "right",
            render: (r) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={async () => {
                    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                    const res = await fetch(`/api/recurring/${r.id}/preview?count=5`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    const body = await res.json();
                    const dates = (body?.data?.dates ?? []).join('\n');
                    alert(`Next due dates:\n${dates || 'no upcoming dates'}`);
                  }}
                  className="rounded px-2 py-1 text-xs text-sky-700 hover:bg-sky-50"
                >
                  Preview
                </button>
                <button onClick={() => runOne.mutate(r.id)} className="rounded px-2 py-1 text-xs text-brand-700 hover:bg-brand-50" disabled={runOne.isPending}>
                  Run
                </button>
                <button onClick={() => confirm(`Delete template ${r.name}?`) && remove.mutate(r.id)} className="text-rose-500 hover:text-rose-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
      />
      {creating && (
        <RecurringForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["recurring"] }); }} />
      )}
    </div>
  );
}
