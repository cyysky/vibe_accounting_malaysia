'use client';

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, FileText, Wallet, Mail, Phone, MapPin } from "lucide-react";
import { api } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";

const fmt = (n: number) => (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR" });

interface Customer {
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
  creditLimit: number;
  outstanding: number;
  active: boolean;
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => api.getCustomer(id) as Promise<Customer> });
  const auditQ = useQuery({ queryKey: ["audit-customer", id], queryFn: () => api.auditLogFor("Customer", id) });

  if (customer.isLoading) return <p className="p-8 text-slate-500">Loading customer…</p>;
  if (customer.error) return <p className="p-8 text-rose-600">Failed to load: {(customer.error as Error).message}</p>;
  const c = customer.data!;
  const addr = [c.addressLine1, c.addressLine2, c.city, c.state, c.postalCode].filter(Boolean).join(", ");

  return (
    <div>
      <PageHeader
        title={c.name}
        description={"Customer code " + c.code}
        breadcrumbs={[{ label: "Receivables", href: "/receivables" }, { label: c.name ?? "" }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={c.active ? "ACTIVE" : "INACTIVE"} />
            <Link href={"/receivables/payments?customerId=" + c.id}>
              <Button variant="secondary"><Wallet className="h-4 w-4" /> Receive payment</Button>
            </Link>
            <Link href={"/receivables/credit-notes?customerId=" + c.id}>
              <Button variant="secondary"><FileText className="h-4 w-4" /> Credit note</Button>
            </Link>
            <Link href="/receivables">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Outstanding" value={fmt(Number(c.outstanding ?? 0))} bold={Number(c.outstanding ?? 0) > 0} />
        <Stat label="Credit limit" value={fmt(Number(c.creditLimit ?? 0))} />
        <Stat label="Currency" value={c.currency ?? "MYR"} />
        <Stat label="Country" value={c.country ?? "MY"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><Building2 className="h-4 w-4" /> Tax / regulatory</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs uppercase text-slate-500">TIN</dt><dd className="font-mono">{c.taxId ?? "—"}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">BRN</dt><dd className="font-mono">{c.brn ?? "—"}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><Mail className="h-4 w-4" /> Contact</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-slate-400" />{c.email ?? "—"}</div>
            <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400" />{c.phone ?? "—"}</div>
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
