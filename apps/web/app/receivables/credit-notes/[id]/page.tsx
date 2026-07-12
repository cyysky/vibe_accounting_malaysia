"use client";



import { useMutation } from "@tanstack/react-query";

import { useQuery } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";

import Link from "next/link";

import { useParams } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { FileMinus2 } from "lucide-react";

import { ListOrdered } from "lucide-react";

import { Receipt } from "lucide-react";

import { Trash2 } from "lucide-react";

import { api } from "../../../../lib/api";

import type { CreditNote } from "../../../../lib/api";

import { Button } from "../../../../components/ui/Button";

import { PageHeader } from "../../../../components/ui/PageHeader";

import { StatusBadge } from "../../../../components/ui/StatusBadge";

import { useToast } from "../../../../components/ui/Toast";



const fmt = (n: number) =>

  (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 });

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-MY") : "—");



export default function CreditNoteDetailPage() {

  const params = useParams<{ id: string }>();

  const id = params.id;

  const qc = useQueryClient();

  const toast = useToast();



  const cn = useQuery({

    queryKey: ["creditNote", id],

    queryFn: () => api.getCreditNote(id),

  });

  const auditQ = useQuery({

    queryKey: ["audit-creditNote", id],

    queryFn: () => api.auditLogFor("CreditNote", id),

  });



  const remove = useMutation({

    mutationFn: () => api.deleteCreditNote(id),

    onSuccess: () => {

      qc.invalidateQueries({ queryKey: ["creditNotes"] });

      window.location.href = "/receivables/credit-notes";

    },

    onError: (e) => toast.error("Delete failed", e.message),

  });



  if (cn.isLoading) return <p className="p-8 text-slate-500">Loading credit note…</p>;

  if (cn.error || !cn.data)

    return <p className="p-8 text-rose-600">Failed to load: {cn.error?.message ?? "not found"}</p>;

  const c = cn.data;

  const lines = c.lines ?? [];



  return (

    <div>

      <PageHeader

        title={"Credit Note " + c.number}

        description={"Customer: " + (c.customer?.name ?? c.customerId)}

        descriptionHref={"/receivables/customers/" + c.customerId}

        breadcrumbs={[

          { label: "Receivables", href: "/receivables" },

          { label: "Credit Notes", href: "/receivables/credit-notes" },

          { label: c.number ?? "" },

        ]}

        actions={

          <div className="flex items-center gap-2">

            <StatusBadge status={c.status} />

            <Button

              variant="danger"

              loading={remove.isPending}

              onClick={() => {

                if (confirm("Delete credit note " + c.number + "? This reverses the GL posting.")) remove.mutate();

              }}

            >

              <Trash2 className="h-4 w-4" /> Delete

            </Button>

            <Link href="/receivables/credit-notes">

              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>

            </Link>

          </div>

        }

      />



      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

        <Stat label="Date" value={fmtDate(c.date)} />

        <Stat label="Reason" value={c.reason} />

        <Stat label="Currency" value={c.currency} />

        <Stat label="Related invoice" value={c.invoice ? c.invoice.number : "—"} bold={!!c.invoice} />

        <Stat label="Subtotal" value={fmt(Number(c.subtotal))} />

        <Stat label="Tax" value={fmt(Number(c.taxTotal))} />

        <Stat label="Total" value={fmt(Number(c.total))} bold />

        <Stat label="Status" value={c.status} />

      </div>



      {c.notes && (

        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">

          <h3 className="mb-1 font-semibold text-slate-700">Notes</h3>

          <p className="whitespace-pre-wrap text-slate-600">{c.notes}</p>

        </div>

      )}



      <div className="mt-6 rounded-lg border bg-white shadow-sm">

        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700">

          <ListOrdered className="h-4 w-4" /> Lines

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">

              <tr>

                <th className="px-4 py-2">#</th>

                <th className="px-4 py-2">Description</th>

                <th className="px-4 py-2 text-right">Qty</th>

                <th className="px-4 py-2 text-right">Price</th>

                <th className="px-4 py-2 text-right">Discount</th>

                <th className="px-4 py-2 text-right">Tax</th>

                <th className="px-4 py-2 text-right">Subtotal</th>

                <th className="px-4 py-2 text-right">Total</th>

              </tr>

            </thead>

            <tbody>

              {lines.map((l, idx) => (

                <tr key={l.id ?? idx} className="border-t">

                  <td className="px-4 py-2 text-slate-400">{l.lineNo ?? idx + 1}</td>

                  <td className="px-4 py-2">{l.description}</td>

                  <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantity).toLocaleString("en-MY")}</td>

                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.unitPrice))}</td>

                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.discount ?? 0))}</td>

                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.taxAmount ?? 0))}</td>

                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.subtotal ?? 0))}</td>

                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.total ?? 0))}</td>

                </tr>

              ))}

              {lines.length === 0 && (

                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No lines.</td></tr>

              )}

            </tbody>

            <tfoot className="border-t bg-slate-50">

              <tr>

                <td colSpan={7} className="px-4 py-2 text-right font-medium">Subtotal</td>

                <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(c.subtotal))}</td>

              </tr>

              <tr>

                <td colSpan={7} className="px-4 py-2 text-right font-medium">Tax</td>

                <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(c.taxTotal))}</td>

              </tr>

              <tr>

                <td colSpan={7} className="px-4 py-2 text-right font-semibold">Total</td>

                <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmt(Number(c.total))}</td>

              </tr>

            </tfoot>

          </table>

        </div>

      </div>



      <div className="mt-6 flex items-center gap-2 rounded-lg border bg-white px-4 py-3 text-xs text-slate-500">

        <Receipt className="h-3 w-3" />

        <span>Credit notes can be submitted to MyInvois as a refund/credit document.</span>

        {c.invoice && (

          <Link href={"/receivables/" + c.invoice.id} className="font-medium text-brand-700 hover:underline">

            Open related invoice →

          </Link>

        )}

      </div>



      {(auditQ.data ?? []).length > 0 && (

        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">

          <h3 className="mb-2 font-semibold text-slate-700">Activity</h3>

          <ol className="space-y-1 text-slate-600">

            {(auditQ.data ?? []).map((e) => (

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

      <div className={"mt-1 " + (bold ? "text-lg font-semibold" : "text-base") + " tabular-nums"}>{value}</div>

    </div>

  );

}
