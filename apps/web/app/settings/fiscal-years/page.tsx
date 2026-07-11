'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Lock, Unlock } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Field, Input, Badge } from '../../../components/ui/Form';
import { PageHeader } from '../../../components/ui/PageHeader';

const fySchema = z.object({
  year: z.coerce.number().int().min(1900),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
});
type FiscalYearForm = z.infer<typeof fySchema>;

interface FiscalYear {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  closed: boolean;
}

export default function FiscalYearsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const fys = useQuery({ queryKey: ['fiscal-years'], queryFn: () => api.fiscalYears() });

  const create = useMutation({
    mutationFn: (data: FiscalYearForm) => api.createFiscalYear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      setShowForm(false);
    },
  });
  const close = useMutation({
    mutationFn: (id: string) => api.closeFiscalYear(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-years'] }),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => api.reopenFiscalYear(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-years'] }),
  });

  const form = useForm<FiscalYearForm>({
    resolver: zodResolver(fySchema),
    defaultValues: { year: new Date().getFullYear(), startDate: '', endDate: '' },
  });

  function openCreate() {
    const y = new Date().getFullYear();
    form.reset({ year: y, startDate: `${y}-01-01`, endDate: `${y}-12-31` });
    setShowForm(true);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal Years"
        description="Open and closed accounting periods. Journals can only be posted to open years."
        actions={
          <>
            <Button onClick={openCreate} variant="primary">
              <Plus className="h-4 w-4" /> New Fiscal Year
            </Button>
          </>
        }
      />

      <DataTable
        data={(fys.data ?? []) as FiscalYear[]}
        loading={fys.isLoading}
        rowKey={(f) => f.id}
        empty="No fiscal years yet - create one to enable journal posting."
        columns={[
          { key: 'year', header: 'Year', render: (f) => <span className="font-mono text-xs">{f.year}</span> },
          { key: 'start', header: 'Start', render: (f) => f.startDate },
          { key: 'end', header: 'End', render: (f) => f.endDate },
          {
            key: 'closed',
            header: 'Status',
            render: (f) => <Badge tone={f.closed ? 'default' : 'success'}>{f.closed ? 'Closed' : 'Open'}</Badge>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (f) => (
              f.closed ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => reopen.mutate(f.id)}
                  loading={reopen.isPending}
                  title="Re-open this fiscal year for posting"
                >
                  <Unlock className="h-4 w-4 text-emerald-600" /> Reopen
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Close fiscal year ${f.year}? Posting will be blocked.`)) close.mutate(f.id);
                  }}
                  loading={close.isPending}
                  title="Close this fiscal year (block further postings)"
                >
                  <Lock className="h-4 w-4 text-amber-600" /> Close
                </Button>
              )
            ),
          },
        ]}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Fiscal Year"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              onClick={form.handleSubmit((d) => create.mutate(d))}
            >
              Create
            </Button>
          </>
        }
      >
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
          onSubmit={form.handleSubmit((d) => create.mutate(d))}
        >
          <Field label="Year" required error={form.formState.errors.year?.message}>
            <Input type="number" {...form.register('year', { valueAsNumber: true })} />
          </Field>
          <Field label="Start" required error={form.formState.errors.startDate?.message}>
            <Input type="date" {...form.register('startDate')} />
          </Field>
          <Field label="End" required error={form.formState.errors.endDate?.message}>
            <Input type="date" {...form.register('endDate')} />
          </Field>
          {create.error && (
            <p className="md:col-span-3 text-sm text-rose-600">{(create.error as Error).message}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
