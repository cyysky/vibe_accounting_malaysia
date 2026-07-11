'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, RefreshCcw, ExternalLink, Wallet, FileMinus2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString('en-MY') : '—');

interface InvoiceLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxCodeId?: string;
  taxAmount?: number;
  subtotal?: number;
  total?: number;
  lineNo?: number;
}

interface Invoice {
  id: string;
  number: string;
  customerId: string;
  date: string;
  dueDate: string;
  currency: string;
  subtotal: number | string;
  taxTotal?: number | string;
  tax?: number | string;
  total: number | string;
  paid?: number | string;
  balance?: number | string;
  status: string;
  einvoiceStatus?: string;
  einvoiceUuid?: string;
  einvoiceLongId?: string;
  lines?: InvoiceLine[];
  customerName?: string;
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const invoice = useQuery({ queryKey: ['invoice', id], queryFn: () => api.getInvoice(id) as Promise<Invoice> });
  const subs = useQuery({ queryKey: ['einvoice-submissions', id], queryFn: () => api.einvoiceSubmissions(id), refetchInterval: 5000 });
    const auditQ = useQuery({ queryKey: ['audit-invoice', id], queryFn: () => api.auditLogFor('CustomerInvoice', id) });
  const paymentsQ = useQuery({ queryKey: ['invoice-payments', id], queryFn: () => api.paymentsByInvoice(id) });

  const submit = useMutation({
    mutationFn: () => api.submitEinvoice(id, { version: '1.1', format: 'JSON' }),
    onSuccess: (r: { submissionUid?: string; submissionId: string }) => {
      setSubmitSuccess('Submitted! Submission UID: ' + (r.submissionUid ?? r.submissionId));
      setSubmitError(null);
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['einvoice-submissions', id] });
    },
    onError: (e: unknown) => {
      const anyErr = e as Error & { response?: { data?: { message?: string } } };
      setSubmitError(anyErr?.response?.data?.message ?? (anyErr as Error).message);
      setSubmitSuccess(null);
    },
  });
  const validate = useMutation({
    mutationFn: () => api.validateEinvoice(id, { version: '1.1', format: 'JSON' }),
    onSuccess: () => {
      setSubmitSuccess(null);
      setSubmitError(null);
    },
    onError: (e: unknown) => {
      // Nest BadRequest with `validation` body carries the full report.
      const anyErr = e as Error & { response?: { data?: { message?: string; validation?: { issues?: { message?: string }[] } } } };
      setSubmitSuccess(null);
      const msg = anyErr?.response?.data?.message ?? (anyErr as Error).message;
      setSubmitError(msg);
    },
  });
  const poll = useMutation({
    mutationFn: (subId: string) => api.pollEinvoiceSubmission(subId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['einvoice-submissions', id] });
    },
  });
  const cancel = useMutation({
    mutationFn: ({ id: sid, reason }: { id: string; reason: string }) => api.cancelEinvoice(sid, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['einvoice-submissions', id] });
    },
  });

  if (invoice.isLoading) return <p className="p-8 text-slate-500">Loading invoice…</p>;
  if (invoice.error) return <p className="p-8 text-rose-600">Failed to load: {(invoice.error as Error).message}</p>;
  const inv = invoice.data!;
  const lines = inv.lines ?? [];

  return (
    <div>
      <PageHeader
        title={'Invoice ' + inv.number}
        description={'Customer: ' + (inv.customerName ?? inv.customerId)}
        descriptionHref={'/receivables/customers/' + inv.customerId}
        breadcrumbs={[{ label: 'Receivables', href: '/receivables' }, { label: inv.number ?? '' }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={inv.status} />
            <StatusBadge status={inv.einvoiceStatus} />
            <Link href={'/receivables/payments?customerId=' + inv.customerId}>
              <Button variant="secondary"><Wallet className="h-4 w-4" /> Record payment</Button>
            </Link>
            <Link href={'/receivables/credit-notes?customerId=' + inv.customerId}>
              <Button variant="secondary"><FileMinus2 className="h-4 w-4" /> Credit note</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Date" value={inv.date} />
        <Stat label="Due" value={inv.dueDate} />
        <Stat label="Subtotal" value={fmt(Number(inv.subtotal ?? 0))} />
        <Stat label="Tax" value={fmt(Number(inv.taxTotal ?? inv.tax ?? 0))} />
        <Stat label="Total" value={fmt(Number(inv.total ?? 0))} bold />
        <Stat label="Paid" value={fmt(Number(inv.paid ?? 0))} />
        <Stat label="Balance" value={fmt(Number(inv.balance ?? 0))} bold />
        <Stat label="Currency" value={inv.currency ?? 'MYR'} />
        <Stat label="e-Invoice UUID" value={inv.einvoiceUuid ?? '—'} mono />
        <Stat label="e-Invoice Long ID" value={inv.einvoiceLongId ?? '—'} mono />
      </div>

      <div className="mt-6 rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700">Lines</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">Disc.</th>
                <th className="px-4 py-2 text-right">Tax</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.id ?? idx} className="border-t">
                  <td className="px-4 py-2 text-slate-400">{l.lineNo ?? idx + 1}</td>
                  <td className="px-4 py-2">{l.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantity).toLocaleString('en-MY')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.unitPrice))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.discount ?? 0))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(l.taxAmount ?? 0))}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{fmt(Number(l.total ?? 0))}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No lines.</td></tr>
              )}
            </tbody>
            <tfoot className="border-t bg-slate-50">
              <tr><td colSpan={6} className="px-4 py-2 text-right text-sm">Subtotal</td><td className="px-4 py-2 text-right">{fmt(Number(inv.subtotal ?? 0))}</td></tr>
              <tr><td colSpan={6} className="px-4 py-2 text-right text-sm">Tax</td><td className="px-4 py-2 text-right">{fmt(Number(inv.taxTotal ?? inv.tax ?? 0))}</td></tr>
              <tr><td colSpan={6} className="px-4 py-2 text-right text-base font-semibold">Total</td><td className="px-4 py-2 text-right text-base font-semibold">{fmt(Number(inv.total ?? 0))}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700">MyInvois (LHDNM e-Invoice)</div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => validate.mutate()}
              loading={validate.isPending}
              variant="secondary"
              title="Run MyInvois UBL pre-submission validation without contacting the API"
            >
              <ShieldCheck className="h-4 w-4" /> Validate
            </Button>
            <Button onClick={() => submit.mutate()} loading={submit.isPending} variant="primary">
              <Send className="h-4 w-4" /> Submit to MyInvois
            </Button>
            {inv.einvoiceUuid && (
              <a className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700" href="/einvoice/submissions">
                <ExternalLink className="h-3 w-3" /> Submissions
              </a>
            )}
          </div>
          {submitSuccess && <p className="mt-3 text-sm text-emerald-700">{submitSuccess}</p>}
          {submitError && <p className="mt-3 text-sm text-rose-600">{submitError}</p>}
          {validate.data && (
            <div className={'mt-3 rounded-md border p-3 text-sm ' + (validate.data.valid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
              <div className="flex items-center gap-2 font-semibold">
                {validate.data.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span>{validate.data.valid ? 'Valid - ready to submit' : 'Issues found - review before submission'}</span>
                <span className="ml-auto font-mono text-xs text-slate-500">{validate.data.documentType} v{validate.data.documentVersion}</span>
              </div>
              {validate.data.issues.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {validate.data.issues.map((i, idx) => (
                    <li key={idx} className={i.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}>
                      <span className="font-mono uppercase">{i.severity}</span>
                      {i.path ? <span className="ml-1 font-mono text-slate-500">{i.path}</span> : null}
                      <span className="ml-1">{i.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(subs.data ?? []).length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Environment</th>
                  <th>Submission UID</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subs.data!.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2"><StatusBadge status={s.environment} /></td>
                    <td className="font-mono text-xs">{s.submissionUid ?? '—'}</td>
                    <td>{s.documentStatus ?? 'Pending'}</td>
                    <td className="text-slate-500">{fmtDate(s.submittedAt)}</td>
                    <td className="space-x-1 text-right">
                      <Button size="sm" variant="ghost" onClick={() => poll.mutate(s.id)} loading={poll.isPending}>
                        <RefreshCcw className="h-4 w-4" /> Poll
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => {
                        const reason = prompt('Reason for cancellation?');
                        if (reason) cancel.mutate({ id: s.id, reason });
                      }}>Cancel</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      

      {(paymentsQ.data ?? []).length > 0 && (
        <div className="mt-6 rounded-lg border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700">
            <Wallet className="h-4 w-4" /> Payments applied
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Payment #</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2 text-right">Applied</th>
                </tr>
              </thead>
              <tbody>
                {paymentsQ.data!.flatMap((p) =>
                  p.applications
                    .filter((a) => a.invoiceId === id)
                    .map((a) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs">{p.number}</span>
                        </td>
                        <td className="px-4 py-2">{p.date}</td>
                        <td className="px-4 py-2">{p.method}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(a.amount))}</td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(auditQ.data ?? []).length > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold text-slate-700">Activity</h3>
          <ol className="space-y-1 text-slate-600">
            {auditQ.data!.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <StatusBadge status={e.action === 'CREATE' ? 'ISSUED' : e.action === 'SUBMIT' ? 'VALID' : 'DRAFT'} />
                <span>{e.action}</span>
                {e.user && <span className="text-slate-400">by {e.user.name ?? e.user.email}</span>}
                <time className="ml-auto text-xs text-slate-400">{fmtDate(e.createdAt)}</time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, bold, mono }: { label: string; value: string | number; bold?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={'mt-1 ' + (bold ? 'text-lg font-semibold' : 'text-base') + ' ' + (mono ? 'font-mono text-xs' : '') + ' tabular-nums'}>{value}</div>
    </div>
  );
}
