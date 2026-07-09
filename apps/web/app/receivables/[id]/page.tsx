'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { Badge, EinvoiceStatusBadge } from '../../../components/ui/Form';

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('en-MY') : '—');

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const invoice = useQuery({ queryKey: ['invoice', id], queryFn: () => api.getInvoice(id) });
  const subs = useQuery({
    queryKey: ['einvoice-submissions', id],
    queryFn: () => api.einvoiceSubmissions(id),
    refetchInterval: 5_000,
  });

  const submit = useMutation({
    mutationFn: () => api.submitEinvoice(id, { version: '1.1', format: 'JSON' }),
    onSuccess: (r) => {
      setSubmitSuccess('Submitted! Submission UID: ' + (r.submissionUid ?? r.submissionId));
      setSubmitError(null);
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['einvoice-submissions', id] });
    },
    onError: (e) => {
      setSubmitError((e as Error).message);
      setSubmitSuccess(null);
    },
  });
  const poll = useMutation({
    mutationFn: (subId: string) => api.pollEinvoiceSubmission(subId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['einvoice-submissions', id] });
    },
  });

  if (invoice.isLoading) return <p className="p-8 text-slate-500">Loading invoice…</p>;
  if (invoice.error) return <p className="p-8 text-rose-600">Failed to load: {(invoice.error as Error).message}</p>;
  const inv = invoice.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/receivables" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Back to Receivables
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Invoice <span className="font-mono">{inv?.number}</span>
          </h1>
          <p className="text-sm text-slate-500">Customer: {inv?.customerName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={inv?.status === "PAID" ? "success" : "default"}>{inv?.status}</Badge>
          <EinvoiceStatusBadge status={inv?.einvoiceStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Date</div>
          <div className="mt-1 text-base">{inv?.date}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Due</div>
          <div className="mt-1 text-base">{inv?.dueDate}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Subtotal</div>
          <div className="mt-1 text-base tabular-nums">{fmt(inv?.subtotal ?? 0)}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Total</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{fmt(inv?.total ?? 0)}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700">MyInvois (LHDNM e-Invoice)</div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => submit.mutate()} loading={submit.isPending} variant="primary">
              <Send className="h-4 w-4" /> Submit to MyInvois
            </Button>
            {inv?.einvoiceUuid && (
              <div className="text-xs text-slate-500">UUID: <span className="font-mono">{inv.einvoiceUuid}</span></div>
            )}
          </div>
          {submitSuccess && <p className="mt-3 text-sm text-emerald-700">{submitSuccess}</p>}
          {submitError && <p className="mt-3 text-sm text-rose-600">{submitError}</p>}

          {(subs.data ?? []).length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2">Environment</th><th>Submission UID</th><th>Status</th><th>Submitted</th><th></th></tr>
              </thead>
              <tbody>
                {subs.data!.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2"><Badge tone={s.environment === "PRODUCTION" ? "danger" : "info"}>{s.environment}</Badge></td>
                    <td className="font-mono text-xs">{s.submissionUid ?? '—'}</td>
                    <td>{s.documentStatus ?? 'Pending'}</td>
                    <td className="text-slate-500">{fmtDate(s.submittedAt)}</td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => poll.mutate(s.id)} loading={poll.isPending}>
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
