"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Download } from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";

const ENTITIES = ["", "CustomerInvoice", "SupplierInvoice", "JournalEntry", "CustomerPayment", "SupplierPayment", "EinvoiceSubmission", "Customer", "Supplier", "Item"];

function entityHref(entity: string, entityId: string): string | null {
  switch (entity) {
    case "CustomerInvoice":
    case "CreditNote":
    case "RecurringInvoice":
      return "/receivables/" + entityId;
    case "SupplierInvoice":
    case "DebitNote":
      return "/payables/" + entityId;
    case "SalesOrder":
      return "/sales/" + entityId;
    case "PurchaseOrder":
      return "/purchase/" + entityId;
    case "Customer":
      return "/receivables/customers/" + entityId;
    case "Supplier":
      return "/payables/suppliers/" + entityId;
    case "JournalEntry":
      return "/dashboard/journal";
    default:
      return null;
  }
}

function actionColor(a: string) {
  if (a === "CREATE" || a === "POST" || a === "SUBMIT" || a === "PAY") return "ISSUED";
  if (a === "DELETE" || a === "CANCEL") return "VOID";
  if (a === "POLL") return "PENDING";
  return "DRAFT";
}

export default function AuditLogPage() {
  const [entity, setEntity] = useState("");
  const q = useQuery({
    queryKey: ["auditLog", entity],
    queryFn: () => api.auditLog(200, entity || undefined),
  });

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description="Audit trail of every change in the system."
        breadcrumbs={[{ label: "Activity" }]}
        actions={
          <div className="flex items-center gap-2">
            <select className="rounded-md border px-3 py-2 text-sm" value={entity} onChange={(e) => setEntity(e.target.value)}>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>{e || "All entities"}</option>
              ))}
            </select>
            <a className="inline-flex items-center gap-1 rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50" href={`/api/audit-log/export.csv${entity ? `?entity=${encodeURIComponent(entity)}` : ''}`}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
          </div>
        }
      />
      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (q.data ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
          <Activity className="h-10 w-10" /> No activity yet.
        </div>
      ) : (
        <ol className="space-y-2">
          {(q.data ?? []).map((e) => (
            <li key={e.id} className="flex items-start gap-3 rounded-md border bg-white p-3">
              <StatusBadge status={actionColor(e.action)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{e.action}</span>
                  <span className="text-slate-500">on</span>
                  {(() => { const href = entityHref(e.entity, e.entityId); const label = e.entity + "#" + e.entityId.slice(0, 8); return href ? <Link href={href} className="font-mono text-xs text-brand-700 hover:underline">{label}</Link> : <span className="font-mono text-xs text-slate-700">{label}</span>; })()}
                  {e.user && <span className="text-xs text-slate-500">by {e.user.name ?? e.user.email}</span>}
                </div>
                {e.message && <p className="mt-1 text-sm text-slate-600">{e.message}</p>}
              </div>
              <time className="shrink-0 text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
