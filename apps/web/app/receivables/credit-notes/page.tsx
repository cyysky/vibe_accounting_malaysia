"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, FileMinus2, Receipt } from "lucide-react";
import { api } from "../../../lib/api";
import type { CreditNote, Customer, CustomerInvoice } from "../../../lib/api";
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
  itemId?: string;
}

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

function CreditNoteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const customersQ = useQuery({ queryKey: ["customers"], queryFn: () => api.customers() });
  const taxCodesQ = useQuery({ queryKey: ["taxCodes"], queryFn: () => api.taxCodes() });
  const invoicesQ = useQuery({
    queryKey: ["customerInvoices"],
    queryFn: () => api.customerInvoices(1, 100).then((p) => p.data),
  });
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", quantity: 1, unitPrice: 0 }]);

  const customerInvoices = useMemo(
    () => (invoicesQ.data ?? []).filter((i: CustomerInvoice) => i.customerId === customerId),
    [invoicesQ.data, customerId],
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
    mutationFn: (payload: Parameters<typeof api.createCreditNote>[0]) => api.createCreditNote(payload),
    onSuccess: () => onSaved(),
  });

  function addLine() {
    setLines([...lines, { description: "", quantity: 1, unitPrice: 0 }]);
  }
  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Credit Note"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={!customerId || lines.length === 0 || !reason}
            onClick={() =>
              create.mutate({
                customerId,
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
                  itemId: l.itemId,
                })),
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Customer *</div>
          <select className="w-full rounded-md border px-3 py-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {(customersQ.data ?? []).map((c: Customer) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Related invoice</div>
          <select className="w-full rounded-md border px-3 py-2" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">— None —</option>
            {customerInvoices.map((i: CustomerInvoice) => (
              <option key={i.id} value={i.id}>{i.number} — {fmt(i.balance)} due {i.dueDate}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Date *</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Reason *</div>
          <input className="w-full rounded-md border px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. returned goods" />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-1 font-medium text-slate-700">Notes</div>
          <textarea className="w-full rounded-md border px-3 py-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lines</h3>
          <Button size="sm" variant="secondary" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add line</Button>
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
                    <td className="px-3 py-2">
                      <input className="w-full rounded border px-2 py-1" value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" className="w-20 rounded border px-2 py-1 text-right" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" className="w-24 rounded border px-2 py-1 text-right" value={l.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" className="w-20 rounded border px-2 py-1 text-right" value={l.discount ?? 0} onChange={(e) => updateLine(idx, { discount: Number(e.target.value) })} />
                    </td>
                    <td className="px-3 py-2">
                      <select className="w-full rounded border px-2 py-1" value={l.taxCodeId ?? ""} onChange={(e) => updateLine(idx, { taxCodeId: e.target.value || undefined })}>
                        <option value="">None</option>
                        {(taxCodesQ.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>{t.code} ({(Number(t.rate) * 100).toFixed(2)}%)</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(sub + tax)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeLine(idx)} className="text-rose-500 hover:text-rose-700" disabled={lines.length === 1}>
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

export default function CreditNotesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["creditNotes"], queryFn: () => api.creditNotes() });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCreditNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creditNotes"] }),
  });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Credit Notes"
        description="Issue refunds or adjustments to customer invoices."
        breadcrumbs={[{ label: "Receivables", href: "/receivables" }, { label: "Credit Notes" }]}
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New credit note</Button>}
      />
      <DataTable<CreditNote>
        data={q.data ?? []}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <FileMinus2 className="h-10 w-10" /> No credit notes yet.
          </div>
        }
        columns={[
          { key: "number", header: "Number", render: (r) => <a href={"/receivables/credit-notes/" + r.id} className="font-mono text-brand-700 hover:underline">{r.number}</a> },
          { key: "date", header: "Date", render: (r) => r.date },
          { key: "customer", header: "Customer", render: (r) => r.customer?.name ?? "-" },
          { key: "invoice", header: "Invoice", render: (r) => r.invoice ? <a href={'/receivables/' + r.invoice.id} className="font-mono text-xs text-brand-700 hover:underline">{r.invoice.number}</a> : "—" },
          { key: "reason", header: "Reason" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "total", header: "Total", align: "right", render: (r) => <span className="tabular-nums">{fmt(Number(r.total))}</span> },
          {
            key: "actions", header: "", align: "right",
            render: (r) => (
              <button className="text-rose-500 hover:text-rose-700" onClick={() => confirm(`Delete credit note ${r.number}?`) && remove.mutate(r.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            ),
          },
        ]}
      />
      {creating && (
        <CreditNoteForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["creditNotes"] });
          }}
        />
      )}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <Receipt className="h-3 w-3" /> Credit notes can be submitted to MyInvois after creation.
      </div>
    </div>
  );
}
