"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, Calendar, Hash, ArrowDownCircle, ArrowUpCircle, FileText, Pencil } from "lucide-react";
import { api } from "../../../../lib/api";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Skeleton, SkeletonTable } from "../../../../components/ui/Skeleton";

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 4 });
const qty = (n: number) =>
  Number(n).toLocaleString("en-MY", { maximumFractionDigits: 4 });

export default function StockMovementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const mov = useQuery({ queryKey: ["stock-movement", id], queryFn: () => api.getStockMovement(id), enabled: !!id });

  if (mov.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <SkeletonTable rows={3} columns={3} />
      </div>
    );
  }
  if (mov.error || !mov.data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-6 text-rose-700">
        Stock movement not found. <Link href="/stock/movements" className="underline">Back to list</Link>
      </div>
    );
  }

  const m = mov.data;
  const isIn = Number(m.quantity) > 0;
  const total = Math.abs(Number(m.quantity)) * Number(m.unitCost);

  return (
    <div className="space-y-6">
      <PageHeader
        title={"Movement " + (m.type || "").toLowerCase()}
        description={m.reference ?? "Manual stock adjustment"}
        breadcrumbs={[{ label: "Stock", href: "/stock" }, { label: "Movements", href: "/stock/movements" }, { label: m.id.slice(0, 8) }]}
        actions={
          <Link href="/stock/movements" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={isIn ? <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> : <ArrowUpCircle className="h-4 w-4 text-rose-600" />} label="Type" valueNode={<StatusBadge status={m.type === "RECEIVE" ? "ISSUED" : m.type === "ISSUE" ? "VOID" : "PENDING"} />} />
        <Stat icon={<Package className="h-4 w-4 text-sky-600" />} label="Quantity" value={qty(Number(m.quantity))} />
        <Stat icon={<FileText className="h-4 w-4 text-violet-600" />} label="Unit cost" value={fmt(Number(m.unitCost))} />
        <Stat icon={<Hash className="h-4 w-4 text-amber-600" />} label="Total" value={fmt(total)} />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Details</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Item</dt>
            <dd>
              {m.item ? (
                <Link href={"/stock/" + m.item.id} className="font-mono text-brand-700 hover:underline">
                  {m.item.code} — {m.item.name}
                </Link>
              ) : "—"}
            </dd>
          </div>
          <div><dt className="text-xs uppercase text-slate-500">Reference</dt><dd>{m.reference ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Recorded at</dt><dd>{new Date(m.createdAt).toLocaleString("en-MY")}</dd></div>
          <div className="md:col-span-2"><dt className="text-xs uppercase text-slate-500">Notes</dt><dd>{m.notes ?? "—"}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><Pencil className="h-4 w-4" /> Audit trail</h2>
        <p className="text-slate-500">Stock movements are recorded through the global audit interceptor. See the activity log for create/update events on this movement.</p>
        <Link href="/audit-log" className="mt-2 inline-block text-brand-700 hover:underline">View activity log →</Link>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, valueNode, mono }: { icon: React.ReactNode; label: string; value?: string; valueNode?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500">{icon}{label}</div>
      <div className={"mt-1 text-base font-semibold " + (mono ? "font-mono" : "")}>{valueNode ?? value}</div>
    </div>
  );
}
