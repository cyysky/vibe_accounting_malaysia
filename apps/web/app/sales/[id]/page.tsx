'use client';

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, ShoppingCart, ExternalLink } from "lucide-react";
import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const fmt = (n: number) => (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR" });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString("en-MY") : "—");

interface OrderLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxCodeId?: string;
  taxAmount?: number;
  subtotal?: number;
  total?: number;
  lineNo?: number;
}

interface SalesOrder {
  id: string;
  number: string;
  customerId: string;
  customerName?: string;
  date: string;
  subtotal: number | string;
  taxTotal?: number | string;
  total: number | string;
  status: string;
  notes?: string;
  lines?: OrderLine[];
}

export default function SalesOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const order = useQuery({ queryKey: ["sales-order", id], queryFn: () => api.getSalesOrder(id) as Promise<SalesOrder> });
  const auditQ = useQuery({ queryKey: ["audit-sales-order", id], queryFn: () => api.auditLogFor("SalesOrder", id) });

  if (order.isLoading) return <p className="p-8 text-slate-500">Loading sales order…</p>;
  if (order.error) return <p className="p-8 text-rose-600">Failed to load: {(order.error as Error).message}</p>;
  const so = order.data!;
  const lines = so.lines ?? [];

  return (
    <div>
      <PageHeader
        title={"Sales Order " + so.number}
        description={"Customer: " + (so.customerName ?? so.customerId)}
        breadcrumbs={[{ label: "Sales", href: "/sales" }, { label: so.number ?? "" }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={so.status} />
            <Link href={"/receivables?customerId=" + so.customerId}>
              <Button variant="secondary"><FileText className="h-4 w-4" /> Create invoice</Button>
            </Link>
            <Link href="/sales">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back to sales orders</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Date" value={so.date} />
        <Stat label="Subtotal" value={fmt(Number(so.subtotal ?? 0))} />
        <Stat label="Tax" value={fmt(Number(so.taxTotal ?? 0))} />
        <Stat label="Total" value={fmt(Number(so.total ?? 0))} bold />
      </div>

      {so.notes && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-1 font-semibold text-slate-700">Notes</h3>
          <p className="whitespace-pre-wrap text-slate-600">{so.notes}</p>
        </div>
      )}

      <div className="mt-6 rounded-lg border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700">
          <ShoppingCart className="h-4 w-4" /> Lines
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">Disc.</th>
                <th className="px-4 py-2 text-right">Tax</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.id ?? idx} className="border-t">
                  <td className="px-4 py-2 text-slate-400">{l.lineNo ?? idx + 1}</td>
                  <td className="px-4 py-2">{l.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantity).toLocaleString("en-MY")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.unitPrice))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.discount ?? 0))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.taxAmount ?? 0))}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{fmt(Number(l.total ?? 0))}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No lines.</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-slate-50">
              <tr><td colSpan={6} className="px-4 py-2 text-right text-sm">Subtotal</td><td className="px-4 py-2 text-right">{fmt(Number(so.subtotal ?? 0))}</td></tr>
              <tr><td colSpan={6} className="px-4 py-2 text-right text-sm">Tax</td><td className="px-4 py-2 text-right">{fmt(Number(so.taxTotal ?? 0))}</td></tr>
              <tr><td colSpan={6} className="px-4 py-2 text-right text-base font-semibold">Total</td><td className="px-4 py-2 text-right text-base font-semibold">{fmt(Number(so.total ?? 0))}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      {(auditQ.data ?? []).length > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold text-slate-700">Activity</h3>
          <ol className="space-y-1 text-slate-600">
            {auditQ.data!.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <StatusBadge status={e.action === "CREATE" ? "ISSUED" : e.action === "UPDATE" ? "DRAFT" : "CANCELLED"} />
                <span>{e.action}</span>
                {e.user && <span className="text-slate-400">by {e.user.name ?? e.user.email}</span>}
                <time className="ml-auto text-xs text-slate-400">{fmtDate(e.createdAt)}</time>
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
