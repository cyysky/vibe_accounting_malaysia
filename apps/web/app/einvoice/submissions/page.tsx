'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, Send, X, Ban, Download } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Form';

const fmt = (d?: string) => (d ? new Date(d).toLocaleString('en-MY') : '—');

export default function EinvoiceSubmissionsPage() {
  const qc = useQueryClient();
  const subs = useQuery({
    queryKey: ['einvoice-submissions'],
    queryFn: () => api.einvoiceSubmissions(),
    refetchInterval: 10_000,
  });

  const poll = useMutation({
    mutationFn: (id: string) => api.pollEinvoiceSubmission(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['einvoice-submissions'] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelEinvoice(id, 'User requested cancellation'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['einvoice-submissions'] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectEinvoice(id, 'Buyer rejected the document'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['einvoice-submissions'] }),
  });
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MyInvois Submissions</h1>
          <p className="text-sm text-slate-500">e-Invoice submission history and status. Auto-refreshes every 10 s.</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && <span className="text-xs text-slate-500">Last sync: {lastSync}</span>}
          <Button variant="secondary" size="sm" onClick={() => recent.mutate()} loading={recent.isPending}>
            <Download className="h-3.5 w-3.5" /> Sync recent
          </Button>
        </div>
      </div>

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
              <div className="flex justify-end gap-1">
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
