'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { api, type Customer, type CustomerInvoice } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Select, Badge, EinvoiceStatusBadge } from '../../components/ui/Form';
import { PageHeader } from '../../components/ui/PageHeader';

const fmt = (n: number) =>
  (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });

const customerSchema = z.object({
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
  creditLimit: z.coerce.number().min(0),
});
type CustomerForm = z.infer<typeof customerSchema>;

export default function ReceivablesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);

  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api.customers() });
  const invoices = useQuery({ queryKey: ['ar-invoices'], queryFn: () => api.customerInvoices() });

  const upsert = useMutation({
    mutationFn: (data: CustomerForm) =>
      editing ? api.updateCustomer(editing.id, data) : api.createCustomer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      code: '',
      name: '',
      country: 'MY',
      currency: 'MYR',
      creditLimit: 0,
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ code: '', name: '', country: 'MY', currency: 'MYR', creditLimit: 0 });
    setShowForm(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    form.reset({
      code: c.code,
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      taxId: c.taxId ?? '',
      brn: c.brn ?? '',
      addressLine1: c.addressLine1 ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      postalCode: c.postalCode ?? '',
      country: c.country,
      currency: c.currency,
      creditLimit: c.creditLimit,
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivables"
        description="Customers, invoices and outstanding balances."
        actions={
          <>
        <Button onClick={openCreate} variant="primary">
          <Plus className="h-4 w-4" /> New Customer
        </Button>
          </>
        }
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Customers</h2>
        <DataTable
          data={customers.data ?? []}
          loading={customers.isLoading}
          rowKey={(c) => c.id}
          empty="No customers yet — click New Customer to get started."
          columns={[
            { key: 'code', header: 'Code', render: (c) => <span className="font-mono text-xs">{c.code}</span> },
            { key: 'name', header: 'Name', render: (c) => <a href={'/receivables/customers/' + c.id} className="font-medium text-brand-700 hover:underline">{c.name}</a> },
            { key: 'taxId', header: 'TIN', render: (c) => c.taxId ?? '—' },
            { key: 'currency', header: 'Currency', render: (c) => c.currency },
            { key: 'creditLimit', header: 'Credit Limit', align: 'right', render: (c) => fmt(c.creditLimit) },
            { key: 'outstanding', header: 'Outstanding', align: 'right', render: (c) => fmt(c.outstanding) },
            {
              key: 'active',
              header: 'Status',
              render: (c) => (
                <Badge tone={c.active ? 'success' : 'default'}>{c.active ? 'Active' : 'Inactive'}</Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (c) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete customer ${c.name}?`)) remove.mutate(c.id);
                    }}
                    aria-label="Delete"
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
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Invoices</h2>
          <a href="/sales/new" className="text-sm text-brand-700 hover:underline">
            Create invoice →
          </a>
        </div>
        <DataTable
          data={invoices.data?.data ?? []}
          loading={invoices.isLoading}
          rowKey={(i) => i.id}
          empty="No invoices yet."
          columns={[
            {
              key: 'number',
              header: 'Number',
              render: (i: CustomerInvoice) => (
                <a href={`/receivables/${i.id}`} className="flex items-center gap-1 font-mono text-xs text-brand-700 hover:underline">
                  <FileText className="h-3.5 w-3.5" /> {i.number}
                </a>
              ),
            },
            { key: 'customer', header: 'Customer', render: (i) => <a href={'/receivables/customers/' + i.customerId} className="text-brand-700 hover:underline">{i.customerName}</a> },
            { key: 'date', header: 'Date', render: (i) => i.date },
            { key: 'due', header: 'Due', render: (i) => i.dueDate },
            { key: 'total', header: 'Total', align: 'right', render: (i) => fmt(i.total) },
            { key: 'balance', header: 'Balance', align: 'right', render: (i) => fmt(i.balance) },
            {
              key: 'status',
              header: 'Status',
              render: (i) => <Badge tone={i.status === 'PAID' ? 'success' : 'default'}>{i.status}</Badge>,
            },
            {
              key: 'einv',
              header: 'e-Invoice',
              render: (i) => <EinvoiceStatusBadge status={i.einvoiceStatus} />,
            },
          ]}
        />
      </section>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Customer' : 'New Customer'}
        size="lg"
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
              {editing ? 'Save changes' : 'Create customer'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((d) => upsert.mutate(d))}>
          <Field label="Code" required error={form.formState.errors.code?.message}>
            <Input {...form.register('code')} placeholder="C001" />
          </Field>
          <Field label="Name" required error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} placeholder="Acme Trading" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register('email')} placeholder="ap@acme.test" />
          </Field>
          <Field label="Phone">
            <Input {...form.register('phone')} placeholder="+60 3-1234 5678" />
          </Field>
          <Field label="Tax ID (TIN)" hint="LHDNM Tax Identification Number">
            <Input {...form.register('taxId')} placeholder="C1234567890" />
          </Field>
          <Field label="BRN" hint="Business Registration Number">
            <Input {...form.register('brn')} placeholder="202101012345 (1234567-X)" />
          </Field>
          <Field label="Credit Limit">
            <Input type="number" step="0.01" {...form.register('creditLimit', { valueAsNumber: true })} />
          </Field>
          <Field label="Currency" required>
            <Select {...form.register('currency')}>
              <option>MYR</option>
              <option>USD</option>
              <option>SGD</option>
              <option>EUR</option>
              <option>GBP</option>
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
          <Field label="Country" required>
            <Select {...form.register('country')}>
              <option value="MY">Malaysia</option>
              <option value="SG">Singapore</option>
              <option value="ID">Indonesia</option>
              <option value="TH">Thailand</option>
            </Select>
          </Field>
          {upsert.error && (
            <p className="md:col-span-2 text-sm text-rose-600">{(upsert.error as Error).message}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
