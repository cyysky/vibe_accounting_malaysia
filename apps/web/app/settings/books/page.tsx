'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api, type AccountBook } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Field, Input, Badge } from '../../../components/ui/Form';
import { useState } from 'react';
import { Plus } from 'lucide-react';

interface Form {
  code: string;
  name: string;
  baseCurrency?: string;
  tin?: string;
  brn?: string;
  industryCode?: string;
}

export default function AccountBooksPage() {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);

  const books = useQuery({ queryKey: ['account-books'], queryFn: () => api.accountBooks() });

  const create = useMutation({
    mutationFn: (data: Form) => api.request<AccountBook>('POST', '/account-books', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-books'] });
      setShow(false);
    },
  });

  const form = useForm<Form>({
    defaultValues: { code: '', name: '', baseCurrency: 'MYR' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account Books</h1>
          <p className="text-sm text-slate-500">Logical companies within your Vibe Accounting workspace.</p>
        </div>
        <Button onClick={() => { form.reset({ code: '', name: '', baseCurrency: 'MYR' }); setShow(true); }}>
          <Plus className="h-4 w-4" /> New Account Book
        </Button>
      </div>

      <DataTable
        data={books.data ?? []}
        loading={books.isLoading}
        rowKey={(b) => b.id}
        empty="No account books yet."
        columns={[
          { key: 'code', header: 'Code', render: (b) => <span className="font-mono text-xs">{b.code}</span> },
          { key: 'name', header: 'Name', render: (b) => <span className="font-medium">{b.name}</span> },
          { key: 'base', header: 'Base Currency' },
          { key: 'tin', header: 'TIN' },
          { key: 'brn', header: 'BRN' },
          {
            key: 'active',
            header: 'Status',
            render: (b) => <Badge tone={b.active ? 'success' : 'default'}>{b.active ? 'Active' : 'Inactive'}</Badge>,
          },
        ]}
      />

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="New Account Book"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((d) => create.mutate(d))}>
              Create
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((d) => create.mutate(d))}>
          <Field label="Code" required>
            <Input {...form.register('code')} placeholder="MAIN" />
          </Field>
          <Field label="Name" required>
            <Input {...form.register('name')} placeholder="Main Operations Sdn Bhd" />
          </Field>
          <Field label="Base Currency">
            <Input {...form.register('baseCurrency')} />
          </Field>
          <Field label="TIN">
            <Input {...form.register('tin')} />
          </Field>
          <Field label="BRN">
            <Input {...form.register('brn')} />
          </Field>
          <Field label="MSIC Industry Code">
            <Input {...form.register('industryCode')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
