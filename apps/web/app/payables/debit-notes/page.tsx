"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, FilePlus2 } from "lucide-react";
import { api } from "../../../lib/api";
import type { DebitNote, Supplier, SupplierInvoice } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

interface LineDraft {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxCodeId?: string;
}

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

function DebitNoteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const suppliersQ = useQuery({ queryKey: ["suppliers"], queryFn: () => api.suppliers() });
  const taxCodesQ = useQuery({ queryKey: ["taxCodes"], queryFn: () => api.taxCodes() });
  const billsQ = useQuery({
    queryKey: ["supplierInvoices"],
    queryFn: () => api.supplierInvoices(1, 100).then((p) => p.data),
  });
  const [supplierId, setSupplierId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", quantity: 1, unitPrice: 0 }]);

  const supplierBills = useMemo(
    () => (billsQ.data ?? []).filter((b: SupplierInvoice) => b.supplierId === supplierId),
    [billsQ.data, supplierId],
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const lineSub = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) - (Number(l.discount) || 0);
      const tc = (taxCodesQ.data ?? []).find((t) => t.id === l.taxCodeId);
      const taxAmount = tc ? lineSub * Number(tc.rate) : 0;
      subtotal += lineSub;
      tax += taxAmount;
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [lines, taxCodesQ.data]);

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof api.createDebitNote>[0]) => api.createDebitNote(payload),
    onSuccess: () => onSaved(),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New Debit Note"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={!supplierId || lines.length === 0 || !reason}
            onClick={() =>
              create.mutate({
                supplierId,
                invoiceId: invoiceId || undefined,
                date,
                reason,
                notes: notes || undefined,
                lines: lines.map((l) => ({
                  description: l.description,
                  quantity: Number(l.quantity),
                  unitPrice: Number(l.unitPrice),
                  discount: Number(l.discount ?? 0),
                  taxCodeId: l.taxCodeId,
                })),
              })
            }
          >Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Supplier *</div>
          <select className="w-full rounded-md border px-3 py-2" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier…</option>
            {(suppliersQ.data ?? []).map((s: Supplier) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Related bill</div>
          <select className="w-full rounded-md border px-3 py-2" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">— None —</option>
            {supplierBills.map((b: SupplierInvoice) => (
              <option key={b.id} value={b.id}>{b.number} — {fmt(Number(b.balance))} due {b.dueDate}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Date *</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Reason *</div>
          <input className="w-full rounded-md border px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. price adjustment" />
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
                <th className="px-3 py-2 text-right">Disc.</th>
                <th className="px-3 py-2">Tax</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const tc = (taxCodesQ.data ?? []).find((t) => t.id === l.taxCodeId);
                const sub = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) - (Number(l.discount) || 0);
                const tax = tc ? sub * Number(tc.rate) : 0;
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2"><input className="w-full rounded border px-2 py-1" value={l.description} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} /></td>
                    <td className="px-3 py-2 text-right"><input type="number" className="w-20 rounded border px-2 py-1 text-right" value={l.quantity} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                    <td className="px-3 py-2 text-right"><input type="number" className="w-24 rounded border px-2 py-1 text-right" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, unitPrice: Number(e.target.value) } : x))} /></td>
                    <td className="px-3 py-2 text-right"><input type="number" className="w-20 rounded border px-2 py-1 text-right" value={l.discount ?? 0} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, discount: Number(e.target.value) } : x))} /></td>
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
                      <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-700" disabled={lines.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-slate-50 text-sm">
              <tr><td colSpan={5} className="px-3 py-2 text-right font-medium">Subtotal</td><td className="px-3 py-2 text-right">{fmt(totals.subtotal)}</td><td></td></tr>
              <tr><td colSpan={5} className="px-3 py-2 text-right font-medium">Tax</td><td className="px-3 py-2 text-right">{fmt(totals.tax)}</td><td></td></tr>
              <tr><td colSpan={5} className="px-3 py-2 text-right font-semibold">Total</td><td className="px-3 py-2 text-right font-semibold">{fmt(totals.total)}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default function DebitNotesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["debitNotes"], queryFn: () => api.debitNotes() });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteDebitNote(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["debitNotes"] }) });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Debit Notes"
        description="Issue additional charges or adjustments against supplier bills."
        breadcrumbs={[{ label: "Payables", href: "/payables" }, { label: "Debit Notes" }]}
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New debit note</Button>}
      />
      <DataTable<DebitNote>
        data={q.data ?? []}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <FilePlus2 className="h-10 w-10" /> No debit notes yet.
          </div>
        }
        columns={[
          { key: "number", header: "Number", render: (r) => <span className="font-mono">{r.number}</span> },
          { key: "date", header: "Date" },
          { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name ?? "-" },
          { key: "bill", header: "Bill", render: (r) => r.invoice?.number ?? "—" },
          { key: "reason", header: "Reason" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "total", header: "Total", align: "right", render: (r) => <span className="tabular-nums">{fmt(Number(r.total))}</span> },
          {
            key: "actions", header: "", align: "right",
            render: (r) => (
              <button className="text-rose-500 hover:text-rose-700" onClick={() => confirm(`Delete debit note ${r.number}?`) && remove.mutate(r.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            ),
          },
        ]}
      />
      {creating && (
        <DebitNoteForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["debitNotes"] }); }} />
      )}
    </div>
  );
}
