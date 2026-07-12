"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ScrollText, Undo2, FileText, ListTree } from "lucide-react";
import { useToast } from "../../../../components/ui/Toast";
import { Skeleton, SkeletonTable } from "../../../../components/ui/Skeleton";
import { api, type JournalEntry, type JournalLine } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";

const fmt = (n: number) => (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR" });

export default function JournalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");
  const j = useQuery({ queryKey: ["journal", id], queryFn: () => api.getJournal(id) });
  const auditQ = useQuery({ queryKey: ["audit-journal", id], queryFn: () => api.auditLogFor("JournalEntry", id) });

  const reverse = useMutation({
    mutationFn: (input: { id: string; reason?: string }) => api.reverseJournal(input.id, input.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal", id] });
      qc.invalidateQueries({ queryKey: ["journals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setReversing(false);
      setReason("");
      toast.success("Journal reversed", "A new reversing entry has been posted.");
    },
    onError: (e: Error) => toast.error("Reversal failed", e.message),
  });

  const toast = useToast();
  if (j.isLoading) return (
    <div className="space-y-4 p-8">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
      <SkeletonTable rows={4} columns={4} />
    </div>
  );
  if (j.error) return <p className="p-8 text-rose-600">Failed to load: {(j.error as Error).message}</p>;
  const journal = j.data!;
  const lines = journal.lines ?? [];
  const reversalOf = lines.length > 0 && (lines[0] as JournalLine).credit > 0 && (lines[0] as JournalLine).debit === 0
    ? null
    : null; // simple heuristic; full "reversalOf" link can be added if the GL service exposes it

  return (
    <div className="space-y-6">
      <PageHeader
        title={"Journal " + journal.number}
        description={journal.description}
        breadcrumbs={[{ label: "Journal Entries", href: "/dashboard/journal" }, { label: journal.number }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={journal.status} />
            {journal.status === "POSTED" && (
              <Button onClick={() => setReversing(true)}>
                <Undo2 className="h-4 w-4" /> Reverse
              </Button>
            )}
            <Link href="/dashboard/journal">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Date" value={journal.date} />
        <Stat label="Reference" value={journal.reference ?? "—"} mono />
        <Stat label="Total debit" value={fmt(Number(journal.totalDebit ?? 0))} />
        <Stat label="Total credit" value={fmt(Number(journal.totalCredit ?? 0))} />
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700"><ListTree className="h-4 w-4" /> Lines</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Memo</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No lines.</td></tr>
              ) : lines.map((l) => {
                const acct: { code?: string; name?: string } | undefined = l.accountId ? (l as JournalLine & { account?: { code: string; name: string } }).account : undefined;
                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-slate-500">{acct?.code ?? l.accountId}</div>
                      <div className="text-sm">{acct?.name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{l.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(l.debit ?? 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(l.credit ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50 text-sm font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totals</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(journal.totalDebit ?? 0))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(journal.totalCredit ?? 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {reversalOf && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This entry is a reversal of <Link className="font-mono text-amber-900 underline" href={"/dashboard/journal/" + reversalOf}>{reversalOf}</Link>.
        </div>
      )}

      {(auditQ.data ?? []).length > 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><FileText className="h-4 w-4" /> Activity</h3>
          <ol className="space-y-1 text-slate-600">
            {auditQ.data!.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <StatusBadge status={e.action === "CREATE" || e.action === "POST" ? "POSTED" : e.action === "REVERSE" ? "REVERSED" : "DRAFT"} />
                <span className="font-medium">{e.action}</span>
                {e.user && <span className="text-slate-400">by {e.user.name ?? e.user.email}</span>}
                <time className="ml-auto text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("en-MY")}</time>
              </li>
            ))}
          </ol>
        </div>
      )}

      {reversing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Undo2 className="h-4 w-4" /> Reverse journal</h2>
            <p className="mb-3 text-sm text-slate-600">
              This will create a new journal entry that flips every line (debit ↔ credit) and mark the original as REVERSED.
              The trial balance will continue to balance.
            </p>
            <label className="text-sm">
              <div className="mb-1 font-medium text-slate-700">Reason (optional)</div>
              <input
                className="w-full rounded-md border px-3 py-2"
                placeholder="e.g. Wrong account posted"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {reverse.error && <p className="mt-2 text-sm text-rose-600">{(reverse.error as Error).message}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setReversing(false); setReason(""); }}>Cancel</Button>
              <Button loading={reverse.isPending} onClick={() => reverse.mutate({ id, reason: reason || undefined })}>
                Reverse
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={"mt-1 text-base font-semibold " + (mono ? "font-mono text-sm" : "")}>{value}</div>
    </div>
  );
}
