'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Field, Input, Badge } from '../../../components/ui/Form';
import { PageHeader } from '../../../components/ui/PageHeader';

const taxCodeSchema = z.object({
  code: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  rate: z.coerce.number().min(0).max(1, 'Rate must be between 0 and 1'),
  description: z.string().optional(),
});
type TaxCodeForm = z.infer<typeof taxCodeSchema>;
export default function TaxCodesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const taxCodes = useQuery({ queryKey: ['tax-codes'], queryFn: () => api.taxCodes() });

  const upsert = useMutation({
    mutationFn: (data: TaxCodeForm) =>
      editing ? api.updateTaxCode(editing.id, data) : api.createTaxCode(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-codes'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTaxCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-codes'] }),
  });

  const form = useForm<TaxCodeForm>({
    resolver: zodResolver(taxCodeSchema),
    defaultValues: { code: '', name: '', rate: 0 },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ code: '', name: '', rate: 0 });
    setShowForm(true);
  }

  function openEdit(tc: { id: string; code: string; name: string; rate: number; description?: string }) {
    setEditing(tc);
    form.reset({ code: tc.code, name: tc.name, rate: tc.rate, description: tc.description ?? '' });
    setShowForm(true);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Codes"
        description="SST / service tax codes used on invoice lines."
        actions={
          <>
        <Button onClick={openCreate} variant="primary">
          <Plus className="h-4 w-4" /> New Tax Code
        </Button>
          </>
        }
      />
      <DataTable
        data={taxCodes.data ?? []}
        loading={taxCodes.isLoading}
        rowKey={(t) => t.id}
        empty="No tax codes yet."
        columns={[
          { key: 'code', header: 'Code', render: (t) => <span className="font-mono text-xs">{t.code}</span> },
          { key: 'name', header: 'Name', render: (t) => t.name },
          {
            key: 'rate',
            header: 'Rate',
            align: 'right',
            render: (t) => `${(t.rate * 100).toFixed(2)}%`,
          },
          { key: 'description', header: 'Description', render: (t) => t.description ?? '—' },
          {
            key: 'active',
            header: 'Status',
            render: (t) => (
              <Badge tone={t.active ? 'success' : 'default'}>{t.active ? 'Active' : 'Inactive'}</Badge>
            ),
          },          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (t) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete tax code ${t.code}?`)) remove.mutate(t.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Tax Code' : 'New Tax Code'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={upsert.isPending}
              onClick={form.handleSubmit((d) => upsert.mutate(d))}
            >
              {editing ? 'Save changes' : 'Create tax code'}
            </Button>
          </>
        }
      >        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={form.handleSubmit((d) => upsert.mutate(d))}
        >
          <Field label="Code" required error={form.formState.errors.code?.message}>
            <Input {...form.register('code')} placeholder="SVAT-12" />
          </Field>
          <Field label="Name" required error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} placeholder="Sales Tax 12%" />
          </Field>
          <Field label="Rate (0..1)" required error={form.formState.errors.rate?.message}>
            <Input type="number" step="0.0001" {...form.register('rate', { valueAsNumber: true })} placeholder="0.12" />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <Input {...form.register('description')} placeholder="LHDNM SST" />
          </Field>
          {upsert.error && (
            <p className="md:col-span-2 text-sm text-rose-600">{(upsert.error as Error).message}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}