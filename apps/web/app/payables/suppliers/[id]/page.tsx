'use client';

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, FileText, Wallet, Mail, Phone, MapPin } from "lucide-react";
import { api } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { TinValidator } from "../../../../components/ui/TinValidator";

const fmt = (n: number) => (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR" });

interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  brn?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  currency: string;
  outstanding: number;
  active: boolean;
}

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supplier = useQuery({ queryKey: ["supplier", id], queryFn: () => api.getSupplier(id) as Promise<Supplier> });
  const auditQ = useQuery({ queryKey: ["audit-supplier", id], queryFn: () => api.auditLogFor("Supplier", id) });

  if (supplier.isLoading) return <p className="p-8 text-slate-500">Loading supplier…</p>;
  if (supplier.error) return <p className="p-8 text-rose-600">Failed to load: {(supplier.error as Error).message}</p>;
  const s = supplier.data!;
  const addr = [s.addressLine1, s.addressLine2, s.city, s.state, s.postalCode].filter(Boolean).join(", ");

  return (
    <div>
      <PageHeader
        title={s.name}
        description={"Supplier code " + s.code}
        breadcrumbs={[{ label: "Payables", href: "/payables" }, { label: s.name ?? "" }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={s.active ? "ACTIVE" : "INACTIVE"} />
            <Link href={"/payables/payments?supplierId=" + s.id}>
              <Button variant="secondary"><Wallet className="h-4 w-4" /> Pay supplier</Button>
            </Link>
            <Link href={"/payables/debit-notes?supplierId=" + s.id}>
              <Button variant="secondary"><FileText className="h-4 w-4" /> Issue debit note</Button>
            </Link>
            <Link href="/payables">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Outstanding" value={fmt(Number(s.outstanding ?? 0))} bold={Number(s.outstanding ?? 0) > 0} />
        <Stat label="Currency" value={s.currency ?? "MYR"} />
        <Stat label="Country" value={s.country ?? "MY"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><Building2 className="h-4 w-4" /> Tax / regulatory</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs uppercase text-slate-500">TIN</dt><dd className="font-mono">{s.taxId ?? "—"}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">BRN</dt><dd className="font-mono">{s.brn ?? "—"}</dd></div>
            <TinValidator tin={s.taxId ?? ""} brn={s.brn ?? undefined} partyName={s.name} />
          </dl>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><Mail className="h-4 w-4" /> Contact</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-slate-400" />{s.email ?? "—"}</div>
            <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400" />{s.phone ?? "—"}</div>
          </dl>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm md:col-span-2">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><MapPin className="h-4 w-4" /> Address</h3>
          <p className="text-sm text-slate-700">{addr || "—"}</p>
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
      <div className={"mt-1 " + (bold ? "text-lg font-semibold text-rose-600" : "text-base") + " tabular-nums"}>{value}</div>
    </div>
  );
}
