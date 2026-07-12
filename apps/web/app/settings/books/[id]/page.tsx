"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Receipt, FileSpreadsheet, Hash, Calendar, MapPin } from "lucide-react";
import { api } from "../../../../lib/api";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Skeleton, SkeletonTable } from "../../../../components/ui/Skeleton";

const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function AccountBookDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const book = useQuery({ queryKey: ["accountBook", id], queryFn: () => api.getAccountBook(id), enabled: !!id });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => api.customers() });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => api.suppliers() });
  const journals = useQuery({ queryKey: ["journals"], queryFn: () => api.journals(1, 5) });

  if (book.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <SkeletonTable rows={4} columns={4} />
      </div>
    );
  }
  if (book.error || !book.data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-6 text-rose-700">
        Account book not found. <Link href="/settings/books" className="underline">Back to list</Link>
      </div>
    );
  }

  const b = book.data;
  const customerCount = (customers.data ?? []).length;
  const supplierCount = (suppliers.data ?? []).length;
  const journalCount = (journals.data as { total?: number } | undefined)?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={b.name}
        description={"Account book " + b.code + " — base currency " + b.baseCurrency}
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Books", href: "/settings/books" }, { label: b.code }]}
        actions={
          <Link href="/settings/books" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat icon={<Building2 className="h-4 w-4 text-sky-600" />} label="Code" value={b.code} mono />
        <Stat icon={<Receipt className="h-4 w-4 text-emerald-600" />} label="Base currency" value={b.baseCurrency} />
        <Stat icon={<Calendar className="h-4 w-4 text-violet-600" />} label="FY start month" value={monthNames[b.fiscalYearStartMonth] ?? String(b.fiscalYearStartMonth)} />
        <Stat icon={<Hash className="h-4 w-4 text-amber-600" />} label="TIN" value={b.tin ?? "—"} mono />
        <Stat icon={<FileSpreadsheet className="h-4 w-4 text-rose-600" />} label="BRN" value={b.brn ?? "—"} mono />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><MapPin className="h-4 w-4" /> Registration</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div><dt className="text-xs uppercase text-slate-500">Industry code (MSIC)</dt><dd className="font-mono">{b.industryCode ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Status</dt><dd>{b.active ? <StatusBadge status="ISSUED" /> : <StatusBadge status="VOID" />}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Reference</dt><dd className="font-mono text-xs">{b.id}</dd></div>
        </dl>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/receivables/customers" className="rounded-lg border bg-white p-4 shadow-sm hover:bg-slate-50">
          <div className="text-xs uppercase text-slate-500">Customers</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{customerCount}</div>
          <div className="mt-1 text-xs text-slate-400">Linked to this book</div>
        </Link>
        <Link href="/payables/suppliers" className="rounded-lg border bg-white p-4 shadow-sm hover:bg-slate-50">
          <div className="text-xs uppercase text-slate-500">Suppliers</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{supplierCount}</div>
          <div className="mt-1 text-xs text-slate-400">Linked to this book</div>
        </Link>
        <Link href="/dashboard/journal" className="rounded-lg border bg-white p-4 shadow-sm hover:bg-slate-50">
          <div className="text-xs uppercase text-slate-500">Journal entries</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{journalCount}</div>
          <div className="mt-1 text-xs text-slate-400">Posted in this book</div>
        </Link>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500">{icon}{label}</div>
      <div className={"mt-1 text-base font-semibold " + (mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}
