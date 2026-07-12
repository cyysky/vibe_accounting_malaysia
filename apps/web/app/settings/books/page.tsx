'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api, type AccountBook } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Field, Input, Badge } from '../../../components/ui/Form';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';

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
    mutationFn: (data: Form) => api.createAccountBook(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-books'] });
      setShow(false);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAccountBook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-books'] }),
  });

  const form = useForm<Form>({
    defaultValues: { code: '', name: '', baseCurrency: 'MYR' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Books"
        description="Logical companies within your Vibe Accounting workspace."
        actions={
          <>
        <Button onClick={() => { form.reset({ code: '', name: '', baseCurrency: 'MYR' }); setShow(true); }}>
          <Plus className="h-4 w-4" /> New Account Book
        </Button>
          </>
        }
      />

      <DataTable
        data={books.data ?? []}
        loading={books.isLoading}
        rowKey={(b) => b.id}
        empty="No account books yet."
        columns={[
          { key: 'code', header: 'Code', render: (b) => <span className="font-mono text-xs">{b.code}</span> },
          { key: 'name', header: 'Name', render: (b) => <Link href={'/settings/books/' + b.id} className="font-medium text-brand-700 hover:underline">{b.name}</Link> },
          { key: 'base', header: 'Base Currency', render: (b) => b.baseCurrency },
          { key: 'tin', header: 'TIN', render: (b) => b.tin ?? '—' },
          { key: 'brn', header: 'BRN', render: (b) => b.brn ?? '—' },
          {
            key: 'active',
            header: 'Status',
            render: (b) => <Badge tone={b.active ? 'success' : 'default'}>{b.active ? 'Active' : 'Inactive'}</Badge>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (b) => (
              <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${b.code}?`) && remove.mutate(b.id)}>
                <Trash2 className="h-4 w-4 text-rose-600" />
              </Button>
            ),
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
