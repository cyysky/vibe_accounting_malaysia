'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { api, type Customer } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Form';

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });

const schema = z.object({
  customerId: z.string().min(1, 'Required'),
  date: z.string().min(1, 'Required'),
  total: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function SalesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const orders = useQuery({ queryKey: ['sales-orders'], queryFn: () => api.salesOrders() });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api.customers() });

  const create = useMutation({
    mutationFn: (data: Form) => api.createSalesOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      setShowForm(false);
    },
  });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: '', date: today, total: 0, notes: '' },
  });

  function openCreate() {
    form.reset({ customerId: '', date: today, total: 0, notes: '' });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Orders</h1>
          <p className="text-sm text-slate-500">Confirmed customer orders before invoicing.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Sales Order
        </Button>
      </div>

      <DataTable
        data={orders.data?.data ?? []}
        loading={orders.isLoading}
        rowKey={(o) => o.id}
        empty="No sales orders yet."
        columns={[
          { key: 'number', header: 'Number', render: (o) => <span className="font-mono text-xs">{o.number}</span> },
          { key: 'customer', header: 'Customer', render: (o) => o.customerName },
          { key: 'date', header: 'Date', render: (o) => o.date },
          { key: 'total', header: 'Total', align: 'right', render: (o) => fmt(o.total) },
          { key: 'status', header: 'Status', render: (o) => o.status },
        ]}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Sales Order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((d) => create.mutate(d))}>
              Create
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((d) => create.mutate(d))}>
          <Field label="Customer" required>
            <Select {...form.register('customerId')}>
              <option value="">Select customer…</option>
              {(customers.data ?? []).map((c: Customer) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required>
            <Input type="date" {...form.register('date')} />
          </Field>
          <Field label="Total">
            <Input type="number" step="0.01" {...form.register('total', { valueAsNumber: true })} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Input {...form.register('notes')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
