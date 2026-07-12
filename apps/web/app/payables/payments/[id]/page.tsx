"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Wallet } from "lucide-react";
import { ListChecks } from "lucide-react";
import { api } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";

const fmt = (n: number) =>
  (n || 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-MY") : "—");

export default function SupplierPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const payment = useQuery({
    queryKey: ["supplierPayment", id],
    queryFn: () => api.supplierPayment(id),
  });
  const auditQ = useQuery({
    queryKey: ["audit-supplierPayment", id],
    queryFn: () => api.auditLogFor("SupplierPayment", id),
  });

  if (payment.isLoading) return <p className="p-8 text-slate-500">Loading payment…</p>;
  if (payment.error || !payment.data)
    return <p className="p-8 text-rose-600">Failed to load: {payment.error?.message || "not found"}</p>;
  const p = payment.data;
  const apps = p.applications || [];
  const appliedTotal = apps.reduce((s, a) => s + Number(a.amount || 0), 0);

  return (
    <div>
      <PageHeader
        title={"Payment " + p.number}
        description={"Supplier: " + (p.supplier?.name || p.supplierId)}
        descriptionHref={"/payables/suppliers/" + p.supplierId}
        breadcrumbs={[
          { label: "Payables", href: "/payables" },
          { label: "Payments", href: "/payables/payments" },
          { label: p.number || "" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status} />
            <Link href="/payables/payments">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Date" value={fmtDate(p.date)} />
        <Stat label="Method" value={p.method} />
        <Stat label="Reference" value={p.reference || "—"} />
        <Stat label="Supplier" value={(p.supplier?.name || p.supplierId || "—") as string} />
        <Stat label="Amount" value={fmt(Number(p.amount))} bold />
        <Stat label="Applied" value={fmt(appliedTotal)} />
        <Stat label="Unapplied" value={fmt(Number(p.amount) - appliedTotal)} />
        <Stat label="Applications" value={String(apps.length)} />
      </div>

      {p.notes && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-1 font-semibold text-slate-700">Notes</h3>
          <p className="whitespace-pre-wrap text-slate-600">{p.notes}</p>
        </div>
      )}

      <div className="mt-6 rounded-lg border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700">
          <ListChecks className="h-4 w-4" /> Applied to bills
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Bill #</th>
                <th className="px-4 py-2">Amount applied</th>
                <th className="px-4 py-2 text-right">Bill total</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">
                    {a.invoice ? (
                      <Link href={"/payables/" + a.invoice.id} className="font-mono text-xs text-brand-700 hover:underline">
                        {a.invoice.number}
                      </Link>
                    ) : a.invoiceId}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{fmt(Number(a.amount))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{a.invoice ? fmt(Number(a.invoice.total)) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{a.invoice ? fmt(Number(a.invoice.paid)) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{a.invoice ? fmt(Number(a.invoice.balance)) : "—"}</td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No applications - this is an unapplied payment.</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-slate-50">
              <tr>
                <td className="px-4 py-2 font-medium">Total applied</td>
                <td className="px-4 py-2 tabular-nums">{fmt(appliedTotal)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-lg border bg-white px-4 py-3 text-xs text-slate-500">
        <Wallet className="h-3 w-3" />
        <span>Supplier payments reduce the supplier outstanding balance and post to GL automatically.</span>
      </div>

      {(auditQ.data || []).length > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold text-slate-700">Activity</h3>
          <ol className="space-y-1 text-slate-600">
            {(auditQ.data || []).map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <StatusBadge status={e.action === "CREATE" ? "PAID" : e.action === "UPDATE" ? "PARTIAL" : "VOID"} />
                <span>{e.action}</span>
                {e.user && <span className="text-slate-400">by {e.user.name || e.user.email}</span>}
                <time className="ml-auto text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("en-MY")}</time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={"mt-1 " + (bold ? "text-lg font-semibold" : "text-base") + " tabular-nums"}>{value}</div>
    </div>
  );
}
