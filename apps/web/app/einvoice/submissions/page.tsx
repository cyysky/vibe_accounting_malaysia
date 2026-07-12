'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, Send, X, Ban, Download, ShieldCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Form';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useToast } from '../../../components/ui/Toast';
import { Skeleton, SkeletonTable } from '../../../components/ui/Skeleton';

const fmt = (d?: string) => (d ? new Date(d).toLocaleString('en-MY') : '—');

export default function EinvoiceSubmissionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const subs = useQuery({
    queryKey: ['einvoice-submissions'],
    queryFn: () => api.einvoiceSubmissions(),
    refetchInterval: 10_000,
  });

  const poll = useMutation({
    mutationFn: (id: string) => api.pollEinvoiceSubmission(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['einvoice-submissions'] }); toast.info('Poll complete', 'Latest status fetched from MyInvois.'); },
    onError: (e: Error) => toast.error('Poll failed', e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelEinvoice(id, 'User requested cancellation'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['einvoice-submissions'] }); toast.success('Submission cancelled', 'MyInvois has been notified.'); },
    onError: (e: Error) => toast.error('Cancel failed', e.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectEinvoice(id, 'Buyer rejected the document'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['einvoice-submissions'] }); toast.warning('Submission rejected', 'Buyer-initiated rejection has been recorded.'); },
    onError: (e: Error) => toast.error('Reject failed', e.message),
  });
  const details = useMutation({
    mutationFn: (id: string) => api.getEinvoiceSubmissionDetails(id),
    onSuccess: (data) => setDetailsPayload(typeof data === "object" ? JSON.stringify(data, null, 2) : String(data)),
    onError: (e: Error) => toast.error("Fetch failed", e.message),
  });
  const documentQ = useMutation({
    mutationFn: (id: string) => api.getEinvoiceDocument(id),
    onSuccess: (data) => setDocumentPayload(typeof data === "object" ? JSON.stringify(data, null, 2) : String(data)),
    onError: (e: Error) => toast.error("Fetch failed", e.message),
  });
  const [detailsPayload, setDetailsPayload] = useState<string | null>(null);
  const [documentPayload, setDocumentPayload] = useState<string | null>(null);
  const recent = useMutation({
    mutationFn: () => api.recentEinvoices('SANDBOX'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['einvoice-submissions'] }),
  });
  const [lastSync, setLastSync] = useState<string | null>(null);
  useEffect(() => {
    if (recent.isSuccess) setLastSync(new Date().toLocaleTimeString('en-MY'));
  }, [recent.isSuccess]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="MyInvois Submissions"
        description="e-Invoice submission history and status. Auto-refreshes every 10 s."
        actions={
          <>
        <div className="flex items-center gap-2">
          {lastSync && <span className="text-xs text-slate-500">Last sync: {lastSync}</span>}
          <Button variant="secondary" size="sm" onClick={() => recent.mutate()} loading={recent.isPending}>
            <Download className="h-3.5 w-3.5" /> Sync recent
          </Button>
        </div>
          </>
        }
      />

      <DataTable
        data={subs.data ?? []}
        loading={subs.isLoading}
        rowKey={(s) => s.id}
        empty="No submissions yet."
        columns={[
          {
            key: 'invoice',
            header: 'Invoice',
            render: (s) => <span className="font-mono text-xs">{s.invoice?.number ?? '—'}</span>,
          },
          { key: 'env', header: 'Env', render: (s) => <Badge tone={s.environment === 'PRODUCTION' ? 'danger' : 'info'}>{s.environment}</Badge> },
          { key: 'type', header: 'Type', render: (s) => s.documentType },
          { key: 'ver', header: 'Ver', render: (s) => s.documentVersion },
          { key: 'fmt', header: 'Fmt', render: (s) => s.format },
          {
            key: 'status',
            header: 'MyInvois Status',
            render: (s) => {
              if (!s.documentStatus) return <Badge tone="warning">Pending</Badge>;
              const map: Record<number, { tone: 'info' | 'success' | 'danger' | 'default'; name: string }> = {
                1: { tone: 'info', name: 'Submitted' },
                2: { tone: 'success', name: 'Valid' },
                3: { tone: 'danger', name: 'Invalid' },
                4: { tone: 'default', name: 'Cancelled' },
              };
              const v = map[s.documentStatus] ?? { tone: 'warning' as const, name: 'Unknown' };
              return <Badge tone={v.tone}>{v.name}</Badge>;
            },
          },
          { key: 'uid', header: 'Submission UID', render: (s) => s.submissionUid ? <span className="font-mono text-[10px]">{s.submissionUid.slice(0, 12)}…</span> : '—' },
          { key: 'submitted', header: 'Submitted', render: (s) => fmt(s.submittedAt) },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (s) => (
              <div className="flex justify-end gap-1 flex-wrap">
                {s.invoiceId && (
                  <Link href={`/receivables/${s.invoiceId}`} title="Re-validate invoice">
                    <Button size="sm" variant="ghost">
                      <ShieldCheck className="h-4 w-4 text-sky-600" /> Validate
                    </Button>
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={() => poll.mutate(s.id)} disabled={poll.isPending}>
                  <RefreshCcw className="h-4 w-4" /> Poll
                </Button>
                {s.documentStatus !== 4 && s.documentStatus !== 3 && (
                  <Button size="sm" variant="ghost" onClick={() => cancel.mutate(s.id)} disabled={cancel.isPending}>
                    <X className="h-4 w-4 text-rose-600" /> Cancel
                  </Button>
                )}
                {s.documentStatus === 2 && (
                  <Button size="sm" variant="ghost" onClick={() => reject.mutate(s.id)} disabled={reject.isPending} title="Buyer-initiated rejection">
                    <Ban className="h-4 w-4 text-amber-600" /> Reject
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

{(detailsPayload || documentPayload) && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              {detailsPayload ? "Submission details" : "Original document"}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(detailsPayload ?? documentPayload ?? "")}
                className="text-xs text-brand-700 hover:underline"
              >
                Copy
              </button>
              <button
                onClick={() => { setDetailsPayload(null); setDocumentPayload(null); }}
                className="text-xs text-slate-500 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
          <pre className="max-h-80 overflow-auto rounded bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
            {detailsPayload ?? documentPayload}
          </pre>
        </div>
      )}

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Send className="h-4 w-4" /> How to submit a new e-invoice
        </div>
        <p className="mt-1">
          Open an issued <a href="/receivables" className="text-brand-700 underline">AR invoice</a>, then click <em>Submit to MyInvois</em>.  Make sure a SANDBOX configuration exists above and the invoice has a customer with a TIN.
        </p>
      </div>
    </div>
  );
}
