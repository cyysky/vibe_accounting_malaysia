'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, type Account } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Field, Input, Select, Badge } from '../../../components/ui/Form';
import { PageHeader } from '../../../components/ui/PageHeader';

const accountSchema = z.object({
  code: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  currency: z.string().min(1, 'Required'),
});
type AccountForm = z.infer<typeof accountSchema>;

export default function ChartOfAccountsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Account | null>(null);
  const [showForm, setShowForm] = useState(false);

  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounts() });

  const upsert = useMutation({
    mutationFn: (data: AccountForm) => (editing ? api.updateAccount(editing.id, data) : api.createAccount(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { code: '', name: '', type: 'ASSET', currency: 'MYR' },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ code: '', name: '', type: 'ASSET', currency: 'MYR' });
    setShowForm(true);
  }
  function openEdit(a: Account) {
    setEditing(a);
    form.reset({ code: a.code, name: a.name, type: a.type, currency: a.currency });
    setShowForm(true);
  }

  const typeTone = (t: string): 'info' | 'warning' | 'success' | 'danger' | 'default' => {
    switch (t) {
      case 'ASSET': return 'info';
      case 'LIABILITY': return 'warning';
      case 'EQUITY': return 'success';
      case 'REVENUE': return 'success';
      case 'EXPENSE': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Your GL account master list."
        actions={
          <>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Account
        </Button>
          </>
        }
      />

      <DataTable
        data={accounts.data ?? []}
        loading={accounts.isLoading}
        rowKey={(a) => a.id}
        empty="No accounts yet."
        columns={[
          { key: 'code', header: 'Code', render: (a) => <span className="font-mono text-xs">{a.code}</span> },
          { key: 'name', header: 'Name', render: (a) => <span className="font-medium">{a.name}</span> },
          {
            key: 'type',
            header: 'Type',
            render: (a) => <Badge tone={typeTone(a.type)}>{a.type}</Badge>,
          },
          { key: 'currency', header: 'Currency', render: (a) => a.currency },
          {
            key: 'active',
            header: 'Status',
            render: (a) => <Badge tone={a.active ? 'success' : 'default'}>{a.active ? 'Active' : 'Inactive'}</Badge>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (a) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirm(`Delete account ${a.code}?`) && remove.mutate(a.id)}
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Account' : 'New Account'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button loading={upsert.isPending} onClick={form.handleSubmit((d) => upsert.mutate(d))}>
              {editing ? 'Save changes' : 'Create account'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((d) => upsert.mutate(d))}>
          <Field label="Code" required>
            <Input {...form.register('code')} placeholder="1010" />
          </Field>
          <Field label="Name" required>
            <Input {...form.register('name')} placeholder="Petty Cash" />
          </Field>
          <Field label="Type" required>
            <Select {...form.register('type')}>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
            </Select>
          </Field>
          <Field label="Currency" required>
            <Select {...form.register('currency')}>
              <option>MYR</option>
              <option>USD</option>
              <option>SGD</option>
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
