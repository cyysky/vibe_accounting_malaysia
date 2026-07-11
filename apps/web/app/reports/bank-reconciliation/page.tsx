"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Landmark, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { DataTable } from "../../../components/ui/DataTable";

const fmt = (n: number | undefined) => (Number(n ?? 0)).toLocaleString("en-MY", { style: "currency", currency: "MYR" });

export default function BankReconciliationListPage() {
  const banks = useQuery({ queryKey: ["bankAccounts"], queryFn: () => api.bankAccounts() });
  const [filter, setFilter] = useState("");

  const filtered = (banks.data ?? []).filter((b) =>
    !filter || b.name.toLowerCase().includes(filter.toLowerCase()) || (b.bankName ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Bank Reconciliation"
        description="Compare your bank statement balance with the linked GL account."
        breadcrumbs={[{ label: "Reports" }, { label: "Bank Reconciliation" }]}
        actions={
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Filter by name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        }
      />

      {(banks.data ?? []).length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-slate-500">
          Create a bank account first under Settings &rarr; Bank Accounts.
        </div>
      ) : (
        <DataTable
          data={filtered}
          rowKey={(b) => b.id}
          loading={banks.isLoading}
          empty="No bank accounts match."
          columns={[
            {
              key: "name",
              header: "Account",
              render: (b) => (
                <Link href={"/reports/bank-reconciliation/" + b.id} className="font-medium text-blue-600 hover:underline">
                  {b.name}
                </Link>
              ),
            },
            { key: "bank", header: "Bank", render: (b) => b.bankName ?? "—" },
            { key: "no", header: "Account no.", render: (b) => <span className="font-mono text-xs">{b.accountNumber ?? "—"}</span> },
            { key: "ccy", header: "CCY", render: (b) => b.currency },
            { key: "status", header: "Status", render: (b) => <StatusBadge status={b.active ? "ACTIVE" : "INACTIVE"} /> },
            {
              key: "open",
              header: "",
              align: "right",
              render: (b) => (
                <Link href={"/reports/bank-reconciliation/" + b.id} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  Reconcile <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ),
            },
          ]}
        />
      )}

      <p className="mt-4 text-xs text-slate-500">
        Pick a bank account above to open its reconciliation view.
      </p>
    </div>
  );
}
