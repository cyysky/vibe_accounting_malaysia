"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wallet, ArrowRightLeft } from "lucide-react";
import { api } from "../../../lib/api";
import type { BankAccount } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const fmt = (n: number) =>
  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

function BankAccountForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [glAccountCode, setGlAccountCode] = useState("1100");
  const [currency, setCurrency] = useState("MYR");
  const [openingBalance, setOpeningBalance] = useState(0);
  const create = useMutation({ mutationFn: (p: Parameters<typeof api.createBankAccount>[0]) => api.createBankAccount(p), onSuccess: () => onSaved() });
  return (
    <Modal
      open
      onClose={onClose}
      title="New Bank Account"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} disabled={!name} onClick={() => create.mutate({ name, bankName: bankName || undefined, accountNumber: accountNumber || undefined, glAccountCode, currency, openingBalance })}>Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Name *</div><input className="w-full rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Operating Account" /></label>
        <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Bank name</div><input className="w-full rounded-md border px-3 py-2" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Maybank" /></label>
        <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Account number</div><input className="w-full rounded-md border px-3 py-2" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></label>
        <label className="text-sm"><div className="mb-1 font-medium text-slate-700">GL Account Code</div><input className="w-full rounded-md border px-3 py-2" value={glAccountCode} onChange={(e) => setGlAccountCode(e.target.value)} /></label>
        <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Currency</div><input className="w-full rounded-md border px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
        <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Opening balance</div><input type="number" className="w-full rounded-md border px-3 py-2" value={openingBalance} onChange={(e) => setOpeningBalance(Number(e.target.value))} /></label>
      </div>
    </Modal>
  );
}

export default function BankAccountsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bankAccounts"], queryFn: () => api.bankAccounts() });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteBankAccount(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["bankAccounts"] }) });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Bank Accounts"
        description="Cash and bank accounts linked to the chart of accounts."
        breadcrumbs={[{ label: "Settings" }, { label: "Bank Accounts" }]}
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New bank account</Button>}
      />
      <DataTable<BankAccount>
        data={q.data ?? []}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <Wallet className="h-10 w-10" /> No bank accounts yet.
          </div>
        }
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "bankName", header: "Bank" },
          { key: "accountNumber", header: "Account #" },
          { key: "glAccountCode", header: "GL code" },
          { key: "currency", header: "Currency" },
          { key: "openingBalance", header: "Opening", align: "right", render: (r) => fmt(Number(r.openingBalance)) },
          { key: "active", header: "Status", render: (r) => <StatusBadge status={r.active ? "ISSUED" : "VOID"} /> },
          {
            key: "actions", header: "", align: "right",
            render: (r) => (
              <div className="flex items-center justify-end gap-1">
                <Link href={`/reports/bank-reconciliation?bankAccountId=${r.id}`} title="Bank reconciliation">
                  <Button size="sm" variant="ghost"><ArrowRightLeft className="h-4 w-4 text-brand-700" /> Reconcile</Button>
                </Link>
                <button onClick={() => confirm(`Delete ${r.name}?`) && remove.mutate(r.id)} className="text-rose-500 hover:text-rose-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
      />
      {creating && <BankAccountForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["bankAccounts"] }); }} />}
    </div>
  );
}
