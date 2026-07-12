'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, Play, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const fmt = (n: number) => (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR" });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-MY") : "—");

export default function RecurringDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const template = useQuery({
    queryKey: ["recurring", id],
    queryFn: () => api.getRecurring(id),
  });
  const auditQ = useQuery({
    queryKey: ["audit-recurring", id],
    queryFn: () => api.auditLogFor("RecurringInvoice", id),
  });
  const previewQ = useQuery({
    queryKey: ["recurring-preview", id],
    queryFn: () => api.previewRecurring(id, 5),
  });

  const [lastRun, setLastRun] = useState<{ invoiceId: string; number: string } | null>(null);
  const runOne = useMutation({
    mutationFn: () => api.runRecurring(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["audit-recurring", id] });
      if (res && res.invoiceId) setLastRun(res);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteRecurring(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      window.location.href = "/recurring";
    },
  });

  if (template.isLoading) return <p className="p-8 text-slate-500">Loading template…</p>;
  if (template.error) return <p className="p-8 text-rose-600">Failed to load: {(template.error as Error).message}</p>;
  const t = template.data!;
  const lines = t.lines ?? [];
  const dates = (previewQ.data?.data?.dates ?? []) as string[];

  return (
    <div>
      <PageHeader
        title={t.name}
        description={"Template for " + (t.customer?.name ?? t.customerId)}
        descriptionHref={"/receivables/customers/" + t.customerId}
        breadcrumbs={[{ label: "Recurring", href: "/recurring" }, { label: t.name ?? "" }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={t.active ? "OPEN" : "CLOSED"} />
            <Button onClick={() => runOne.mutate()} loading={runOne.isPending} variant="primary">
              <Play className="h-4 w-4" /> Run now
            </Button>
            <Button variant="danger" onClick={() => confirm("Delete template " + t.name + "?") && remove.mutate()} loading={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Link href="/recurring">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
          </div>
        }
      />

      {lastRun && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>Generated invoice <strong>{lastRun.number}</strong>.</span>
          <Link href={"/receivables/" + lastRun.invoiceId} className="font-medium text-emerald-700 hover:underline">Open →</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Frequency" value={t.frequency} />
        <Stat label="Start date" value={fmtDate(t.startDate)} />
        <Stat label="Next run" value={fmtDate(t.nextRunDate)} bold />
        <Stat label="Last run" value={fmtDate(t.lastRunDate)} />
        <Stat label="End date" value={fmtDate(t.endDate)} />
        <Stat label="Currency" value={t.currency ?? "MYR"} />
        <Stat label="Active" value={t.active ? "Yes" : "No"} />
      </div>

      {t.notes && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-1 font-semibold text-slate-700">Notes</h3>
          <p className="whitespace-pre-wrap text-slate-600">{t.notes}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700">
            <Repeat className="h-4 w-4" /> Lines
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={l.id ?? idx} className="border-t">
                    <td className="px-4 py-2 text-slate-400">{l.lineNo ?? idx + 1}</td>
                    <td className="px-4 py-2">{l.description}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantity).toLocaleString("en-MY")}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.unitPrice))}</td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No lines.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700">
            <Calendar className="h-4 w-4" /> Upcoming due dates
          </div>
          <div className="p-4 text-sm">
            {previewQ.isLoading && (
              <div className="space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
              </div>
            )}
            {!previewQ.isLoading && dates.length === 0 && (
              <p className="text-slate-500">No upcoming dates.</p>
            )}
            <ol className="space-y-1">
              {dates.map((d) => (
                <li key={d} className="font-mono text-xs">{d}</li>
              ))}
            </ol>
          </div>
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
