'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { api, type Supplier } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Select, Badge } from '../../components/ui/Form';
import { PageHeader } from '../../components/ui/PageHeader';

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });

const supplierSchema = z.object({
  code: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  brn: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1, 'Required'),
  currency: z.string().min(1, 'Required'),
});
type SupplierForm = z.infer<typeof supplierSchema>;

export default function PayablesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);

  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.suppliers() });
  const bills = useQuery({ queryKey: ['ap-invoices'], queryFn: () => api.supplierInvoices() });

  const upsert = useMutation({
    mutationFn: (data: SupplierForm) =>
      editing ? api.updateSupplier(editing.id, data) : api.createSupplier(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setShowForm(false);
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const form = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { code: '', name: '', country: 'MY', currency: 'MYR' },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ code: '', name: '', country: 'MY', currency: 'MYR' });
    setShowForm(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    form.reset({
      code: s.code,
      name: s.name,
      email: s.email ?? '',
      phone: s.phone ?? '',
      taxId: s.taxId ?? '',
      brn: s.brn ?? '',
      addressLine1: s.addressLine1 ?? '',
      city: s.city ?? '',
      state: s.state ?? '',
      postalCode: s.postalCode ?? '',
      country: s.country,
      currency: s.currency,
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payables"
        description="Suppliers, bills and outstanding balances."
        actions={
          <>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Supplier
        </Button>
          </>
        }
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Suppliers</h2>
        <DataTable
          data={suppliers.data ?? []}
          loading={suppliers.isLoading}
          rowKey={(s) => s.id}
          empty="No suppliers yet."
          columns={[
            { key: 'code', header: 'Code', render: (s) => <span className="font-mono text-xs">{s.code}</span> },
            { key: 'name', header: 'Name', render: (s) => <span className="font-medium">{s.name}</span> },
            { key: 'taxId', header: 'TIN', render: (s) => s.taxId ?? '—' },
            { key: 'currency', header: 'Currency', render: (s) => s.currency },
            { key: 'outstanding', header: 'Outstanding', align: 'right', render: (s) => fmt(s.outstanding) },
            {
              key: 'active',
              header: 'Status',
              render: (s) => <Badge tone={s.active ? 'success' : 'default'}>{s.active ? 'Active' : 'Inactive'}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (s) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confirm(`Delete ${s.name}?`) && remove.mutate(s.id)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Bills</h2>
        <DataTable
          data={bills.data?.data ?? []}
          loading={bills.isLoading}
          rowKey={(i) => i.id}
          empty="No bills yet."
          columns={[
            { key: 'number', header: 'Number', render: (i) => <a href={`/payables/${i.id}`} className="flex items-center gap-1 font-mono text-xs text-brand-700 hover:underline"><FileText className="h-3.5 w-3.5" /> {i.number}</a> },
            { key: 'supplier', header: 'Supplier', render: (i) => i.supplierName },
            { key: 'date', header: 'Date', render: (i) => i.date },
            { key: 'due', header: 'Due', render: (i) => i.dueDate },
            { key: 'total', header: 'Total', align: 'right', render: (i) => fmt(i.total) },
            { key: 'balance', header: 'Balance', align: 'right', render: (i) => fmt(i.balance) },
            { key: 'status', header: 'Status', render: (i) => <Badge>{i.status}</Badge> },
          ]}
        />
      </section>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Supplier' : 'New Supplier'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button loading={upsert.isPending} onClick={form.handleSubmit((d) => upsert.mutate(d))}>
              {editing ? 'Save changes' : 'Create supplier'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((d) => upsert.mutate(d))}>
          <Field label="Code" required>
            <Input {...form.register('code')} placeholder="S001" />
          </Field>
          <Field label="Name" required>
            <Input {...form.register('name')} placeholder="Initech Supplies" />
          </Field>
          <Field label="Email">
            <Input type="email" {...form.register('email')} />
          </Field>
          <Field label="Phone">
            <Input {...form.register('phone')} />
          </Field>
          <Field label="Tax ID (TIN)">
            <Input {...form.register('taxId')} />
          </Field>
          <Field label="BRN">
            <Input {...form.register('brn')} />
          </Field>
          <Field label="Currency" required>
            <Select {...form.register('currency')}>
              <option>MYR</option>
              <option>USD</option>
              <option>SGD</option>
            </Select>
          </Field>
          <Field label="Country" required>
            <Select {...form.register('country')}>
              <option value="MY">Malaysia</option>
              <option value="SG">Singapore</option>
              <option value="ID">Indonesia</option>
              <option value="TH">Thailand</option>
            </Select>
          </Field>
          <Field label="Address Line 1" className="md:col-span-2">
            <Input {...form.register('addressLine1')} />
          </Field>
          <Field label="City">
            <Input {...form.register('city')} />
          </Field>
          <Field label="State">
            <Input {...form.register('state')} />
          </Field>
          <Field label="Postal Code">
            <Input {...form.register('postalCode')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
