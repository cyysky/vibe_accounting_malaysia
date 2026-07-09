'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { api, type Supplier } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Form';

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });

const schema = z.object({
  supplierId: z.string().min(1, 'Required'),
  date: z.string().min(1, 'Required'),
  total: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function PurchasePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const orders = useQuery({ queryKey: ['purchase-orders'], queryFn: () => api.purchaseOrders() });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.suppliers() });

  const create = useMutation({
    mutationFn: (data: Form) => api.createPurchaseOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setShowForm(false);
    },
  });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', date: today, total: 0, notes: '' },
  });

  function openCreate() {
    form.reset({ supplierId: '', date: today, total: 0, notes: '' });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-slate-500">Confirmed supplier orders before billing.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Purchase Order
        </Button>
      </div>

      <DataTable
        data={orders.data?.data ?? []}
        loading={orders.isLoading}
        rowKey={(o) => o.id}
        empty="No purchase orders yet."
        columns={[
          { key: 'number', header: 'Number', render: (o) => <span className="font-mono text-xs">{o.number}</span> },
          { key: 'supplier', header: 'Supplier', render: (o) => o.supplierName },
          { key: 'date', header: 'Date', render: (o) => o.date },
          { key: 'total', header: 'Total', align: 'right', render: (o) => fmt(o.total) },
          { key: 'status', header: 'Status', render: (o) => o.status },
        ]}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Purchase Order"
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
          <Field label="Supplier" required>
            <Select {...form.register('supplierId')}>
              <option value="">Select supplier…</option>
              {(suppliers.data ?? []).map((s: Supplier) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
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
