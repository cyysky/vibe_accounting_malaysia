"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Lock, Unlock, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Skeleton, SkeletonTable } from "../../../../components/ui/Skeleton";
import { useToast } from "../../../../components/ui/Toast";

export default function FiscalYearDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const toast = useToast();
  const fy = useQuery({
    queryKey: ["fiscal-year", id],
    queryFn: async () => {
      const all = await api.fiscalYears();
      const hit = (all ?? []).find((f) => f.id === id);
      if (!hit) throw new Error("Fiscal year not found");
      return hit;
    },
    enabled: !!id,
  });
  const close = useMutation({
    mutationFn: () => api.closeFiscalYear(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fiscal-year", id] }); qc.invalidateQueries({ queryKey: ["fiscal-years"] }); toast.success("Fiscal year closed"); },
    onError: (e: Error) => toast.error("Close failed", e.message),
  });
  const reopen = useMutation({
    mutationFn: () => api.reopenFiscalYear(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fiscal-year", id] }); qc.invalidateQueries({ queryKey: ["fiscal-years"] }); toast.success("Fiscal year re-opened"); },
    onError: (e: Error) => toast.error("Reopen failed", e.message),
  });
  const journals = useQuery({ queryKey: ["journals", { fiscalYearId: id }], queryFn: () => api.journals(1, 50) });

  if (fy.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <SkeletonTable rows={4} columns={4} />
      </div>
    );
  }
  if (fy.error || !fy.data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-6 text-rose-700">
        Fiscal year not found. <Link href="/settings/fiscal-years" className="underline">Back to list</Link>
      </div>
    );
  }

  const f = fy.data;
  const start = new Date(f.startDate);
  const end = new Date(f.endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const journalCount = (journals.data as { total?: number } | undefined)?.total ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const isCurrent = today >= f.startDate && today <= f.endDate;

  return (
    <div className="space-y-6">
      <PageHeader
        title={"Fiscal Year " + f.year}
        description={(f.closed ? "Closed" : isCurrent ? "Currently active" : "Future period") + " — " + f.startDate + " to " + f.endDate}
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Fiscal Years", href: "/settings/fiscal-years" }, { label: String(f.year) }]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/settings/fiscal-years" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            {f.closed ? (
              <Button variant="secondary" onClick={() => reopen.mutate()} loading={reopen.isPending}>
                <Unlock className="h-4 w-4 text-emerald-600" /> Re-open
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => close.mutate()} loading={close.isPending}>
                <Lock className="h-4 w-4 text-amber-700" /> Close year
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Calendar className="h-4 w-4 text-sky-600" />} label="Start" value={f.startDate} mono />
        <Stat icon={<Calendar className="h-4 w-4 text-rose-600" />} label="End" value={f.endDate} mono />
        <Stat icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Days" value={String(days)} />
        <Stat icon={<XCircle className={"h-4 w-4 " + (f.closed ? "text-slate-400" : "text-emerald-600")} />} label="Status" valueNode={f.closed ? <StatusBadge status="VOID" /> : <StatusBadge status="ISSUED" />} />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Posting activity</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href={"/dashboard/journal?from=" + f.startDate + "&to=" + f.endDate} className="rounded-md border bg-slate-50 px-3 py-3 hover:bg-slate-100">
            <div className="text-xs uppercase text-slate-500">Journal entries in period</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{journalCount}</div>
          </Link>
          <Link href={"/reports/general-ledger?from=" + f.startDate + "&to=" + f.endDate} className="rounded-md border bg-slate-50 px-3 py-3 hover:bg-slate-100">
            <div className="text-xs uppercase text-slate-500">General ledger</div>
            <div className="mt-1 text-sm font-medium text-brand-700">View →</div>
          </Link>
          <Link href={"/reports/trial-balance?asOf=" + f.endDate} className="rounded-md border bg-slate-50 px-3 py-3 hover:bg-slate-100">
            <div className="text-xs uppercase text-slate-500">Trial balance</div>
            <div className="mt-1 text-sm font-medium text-brand-700">View →</div>
          </Link>
        </div>
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
