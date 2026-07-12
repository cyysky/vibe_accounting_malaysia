"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../components/ui/Toast";
import { Plus, Wallet } from "lucide-react";
import { api } from "../../../lib/api";
import type { Customer, CustomerInvoice, Payment } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

interface AppRow {
  invoiceId: string;
  amount: number;
}

function PaymentForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const customersQ = useQuery({ queryKey: ["customers"], queryFn: () => api.customers() });
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("BANK");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [applications, setApplications] = useState<AppRow[]>([]);

  const customerInvoices = useQuery({
    queryKey: ["customerInvoicesForPayment", customerId],
    enabled: !!customerId,
    queryFn: () => api.customerInvoices(1, 100, customerId).then((p) => p.data),
  });

  const openInvoices = useMemo(
    () => (customerInvoices.data ?? []).filter((i: CustomerInvoice) => Number(i.balance) > 0),
    [customerInvoices.data],
  );

  const appliedTotal = applications.reduce((s, a) => s + a.amount, 0);
  const remaining = amount - appliedTotal;

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof api.createCustomerPayment>[0]) => api.createCustomerPayment(payload),
    onSuccess: () => onSaved(),
  });

  function toggleInvoice(inv: CustomerInvoice) {
    if (applications.find((a) => a.invoiceId === inv.id)) {
      setApplications(applications.filter((a) => a.invoiceId !== inv.id));
    } else {
      const balance = Number(inv.balance);
      const remainingToApply = amount - appliedTotal;
      const apply = Math.min(balance, remainingToApply || balance);
      setApplications([...applications, { invoiceId: inv.id, amount: apply }]);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record Customer Payment"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={!customerId || amount <= 0 || Math.abs(remaining) > 0.01}
            onClick={() =>
              create.mutate({
                customerId,
                date,
                amount,
                method,
                reference: reference || undefined,
                notes: notes || undefined,
                applications,
              })
            }
          >
            Save & post
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="text-sm md:col-span-1">
          <div className="mb-1 font-medium text-slate-700">Customer *</div>
          <select className="w-full rounded-md border px-3 py-2" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setApplications([]); }}>
            <option value="">Select…</option>
            {(customersQ.data ?? []).map((c: Customer) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Date *</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Method *</div>
          <select className="w-full rounded-md border px-3 py-2" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="EFT">EFT</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Amount *</div>
          <input type="number" className="w-full rounded-md border px-3 py-2" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Reference</div>
          <input className="w-full rounded-md border px-3 py-2" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no / EFT ref" />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Notes</div>
          <input className="w-full rounded-md border px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {customerId && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Apply to invoices</h3>
            <div className="text-xs text-slate-500">
              Applied {fmt(appliedTotal)} / {fmt(amount)} — Remaining {fmt(remaining)}
            </div>
          </div>
          {customerInvoices.isLoading ? (
            <p className="text-sm text-slate-500">Loading invoices…</p>
          ) : openInvoices.length === 0 ? (
            <p className="text-sm text-slate-500">No open invoices for this customer.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th></th>
                    <th className="px-3 py-2 text-left">Invoice</th>
                    <th className="px-3 py-2 text-left">Due</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2 text-right">Apply</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv: CustomerInvoice) => {
                    const app = applications.find((a) => a.invoiceId === inv.id);
                    const checked = !!app;
                    return (
                      <tr key={inv.id} className="border-t">
                        <td className="px-3 py-2"><input type="checkbox" checked={checked} onChange={() => toggleInvoice(inv)} /></td>
                        <td className="px-3 py-2">{inv.number}</td>
                        <td className="px-3 py-2">{inv.dueDate}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(inv.balance))}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="w-24 rounded border px-2 py-1 text-right"
                            disabled={!checked}
                            value={app?.amount ?? 0}
                            onChange={(e) =>
                              setApplications(applications.map((a) => a.invoiceId === inv.id ? { ...a, amount: Number(e.target.value) } : a))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function CustomerPaymentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customerPayments"], queryFn: () => api.customerPayments() });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Customer Payments"
        description="Record receipts from customers and apply them to open invoices."
        breadcrumbs={[{ label: "Receivables", href: "/receivables" }, { label: "Payments" }]}
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New payment</Button>}
      />
      <DataTable<Payment>
        data={q.data ?? []}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <Wallet className="h-10 w-10" /> No payments recorded yet.
          </div>
        }
        columns={[
          { key: "number", header: "Receipt #", render: (r) => <span className="font-mono">{r.number}</span> },
          { key: "date", header: "Date" },
          { key: "customer", header: "Customer", render: (r) => r.customer?.name ?? "-" },
          { key: "method", header: "Method", render: (r) => <StatusBadge status={r.method} /> },
          { key: "amount", header: "Amount", align: "right", render: (r) => <span className="tabular-nums">{fmt(Number(r.amount))}</span> },
          { key: "applied", header: "Applied to", render: (r) => r.applications.length === 0 ? "—" : r.applications.map((a) => a.invoice ? <a key={a.invoice.id} href={'/receivables/' + a.invoice.id} className="font-mono text-xs text-brand-700 hover:underline mr-1">{a.invoice.number}</a> : null) },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      {creating && (
        <PaymentForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["customerPayments"] }); }} />
      )}
    </div>
  );
}
