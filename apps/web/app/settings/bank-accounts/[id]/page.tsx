"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet, Building2, Hash, Banknote, ArrowRightLeft } from "lucide-react";
import { api } from "../../../../lib/api";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Skeleton, SkeletonTable } from "../../../../components/ui/Skeleton";

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

export default function BankAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const bank = useQuery({ queryKey: ["bankAccount", id], queryFn: () => api.getBankAccount(id), enabled: !!id });

  if (bank.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <SkeletonTable rows={4} columns={4} />
      </div>
    );
  }
  if (bank.error || !bank.data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-6 text-rose-700">
        Bank account not found. <Link href="/settings/bank-accounts" className="underline">Back to list</Link>
      </div>
    );
  }

  const a = bank.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={a.name}
        description={(a.bankName ?? "Bank account") + " — " + (a.accountNumber ?? "no account number")}
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Bank Accounts", href: "/settings/bank-accounts" }, { label: a.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/settings/bank-accounts" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <Link href={"/reports/bank-reconciliation/" + a.id} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <ArrowRightLeft className="h-4 w-4" /> Reconcile
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Wallet className="h-4 w-4 text-sky-600" />} label="Currency" value={a.currency} />
        <Stat icon={<Banknote className="h-4 w-4 text-emerald-600" />} label="Opening balance" value={fmt(Number(a.openingBalance))} />
        <Stat icon={<Hash className="h-4 w-4 text-violet-600" />} label="GL account code" value={a.glAccountCode ?? "—"} mono />
        <Stat icon={<Building2 className="h-4 w-4 text-amber-600" />} label="Status" valueNode={a.active ? <StatusBadge status="ISSUED" /> : <StatusBadge status="VOID" />} />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Bank details</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-xs uppercase text-slate-500">Bank name</dt><dd>{a.bankName ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Account number</dt><dd className="font-mono">{a.accountNumber ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Reference</dt><dd className="font-mono text-xs">{a.id}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Related views</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Link href={"/reports/bank-reconciliation/" + a.id} className="rounded-md border bg-slate-50 px-3 py-3 hover:bg-slate-100">
            <div className="text-xs uppercase text-slate-500">Bank reconciliation</div>
            <div className="mt-1 text-sm font-medium text-brand-700">Reconcile now →</div>
          </Link>
          <Link href={"/reports/general-ledger?account=" + (a.glAccountCode ?? "")} className="rounded-md border bg-slate-50 px-3 py-3 hover:bg-slate-100">
            <div className="text-xs uppercase text-slate-500">General ledger (GL)</div>
            <div className="mt-1 text-sm font-medium text-brand-700">View postings →</div>
          </Link>
          <Link href={"/dashboard"} className="rounded-md border bg-slate-50 px-3 py-3 hover:bg-slate-100">
            <div className="text-xs uppercase text-slate-500">Cash position</div>
            <div className="mt-1 text-sm font-medium text-brand-700">Dashboard →</div>
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
