"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Percent, FileText, Hash, Calendar } from "lucide-react";
import { api } from "../../../../lib/api";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Skeleton, SkeletonTable } from "../../../../components/ui/Skeleton";

const TAX_TYPE_LABEL: Record<string, string> = {
  "01": "Sales Tax",
  "02": "Service Tax",
  "03": "Tourism Tax",
  "04": "High-Value Goods Tax",
  "05": "Sales Tax on Low-Value Goods",
  "06": "Service Tax on Imported Low-Value Goods",
  "E": "Exempt",
};

export default function TaxCodeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const tc = useQuery({
    queryKey: ["tax-code", id],
    queryFn: async () => {
      const all = await api.taxCodes();
      const hit = (all ?? []).find((x) => x.id === id);
      if (!hit) throw new Error("Tax code not found");
      return hit;
    },
    enabled: !!id,
  });

  if (tc.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <SkeletonTable rows={4} columns={3} />
      </div>
    );
  }
  if (tc.error || !tc.data) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-6 text-rose-700">
        Tax code not found. <Link href="/settings/tax-codes" className="underline">Back to list</Link>
      </div>
    );
  }

  const t = tc.data;
  const pct = (Number(t.rate) * 100).toLocaleString("en-MY", { maximumFractionDigits: 4 });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.name}
        description={"Tax code " + t.code + " (" + pct + "%)"}
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Tax Codes", href: "/settings/tax-codes" }, { label: t.code }]}
        actions={
          <Link href="/settings/tax-codes" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Hash className="h-4 w-4 text-sky-600" />} label="Code" value={t.code} mono />
        <Stat icon={<Percent className="h-4 w-4 text-emerald-600" />} label="Rate" value={pct + "%"} />
        <Stat icon={<FileText className="h-4 w-4 text-violet-600" />} label="Type" value={TAX_TYPE_LABEL[(t as unknown as { taxTypeCode?: string }).taxTypeCode ?? "01"] ?? "Sales Tax"} />
        <Stat icon={<Calendar className="h-4 w-4 text-amber-600" />} label="Status" valueNode={t.active ? <StatusBadge status="ISSUED" /> : <StatusBadge status="VOID" />} />
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Notes</h2>
        <p className="text-sm text-slate-600">{t.description ?? "No description provided."}</p>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Where this is used</h2>
        <p className="text-sm text-slate-600">
          Tax codes flow into customer invoices, supplier bills, journal postings and MyInvois e-invoice documents. Edit active codes carefully — historical postings remain unchanged but new lines pick up the new rate.
        </p>
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
