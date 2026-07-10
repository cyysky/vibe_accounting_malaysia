'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { api, type Item } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Badge } from '../../components/ui/Form';
import { PageHeader } from '../../components/ui/PageHeader';

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });

const itemSchema = z.object({
  code: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  uom: z.string().min(1, 'Required'),
  cost: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  onHand: z.coerce.number(),
  reorderLevel: z.coerce.number(),
  classification: z.string().optional(),
});
type ItemForm = z.infer<typeof itemSchema>;

export default function StockPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);

  const items = useQuery({ queryKey: ['items'], queryFn: () => api.items() });

  const upsert = useMutation({
    mutationFn: (data: ItemForm) => (editing ? api.updateItem(editing.id, data) : api.createItem(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      setShowForm(false);
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });

  const form = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { code: '', name: '', uom: 'PCS', cost: 0, price: 0, onHand: 0, reorderLevel: 0 },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ code: '', name: '', uom: 'PCS', cost: 0, price: 0, onHand: 0, reorderLevel: 0 });
    setShowForm(true);
  }
  function openEdit(i: Item) {
    setEditing(i);
    form.reset({
      code: i.code,
      name: i.name,
      description: i.description ?? '',
      uom: i.uom,
      cost: i.cost,
      price: i.price,
      onHand: i.onHand,
      reorderLevel: i.reorderLevel,
      classification: i.classification ?? '',
    });
    setShowForm(true);
  }

  const lowStockCount = (items.data ?? []).filter((i) => i.onHand <= i.reorderLevel).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock / Items"
        description="Inventory items and reorder alerts."
        actions={
          <>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Item
        </Button>
          </>
        }
      />

      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          {lowStockCount} item(s) at or below reorder level.
        </div>
      )}

      <DataTable
        data={items.data ?? []}
        loading={items.isLoading}
        rowKey={(i) => i.id}
        empty="No items yet."
        columns={[
          { key: 'code', header: 'Code', render: (i) => <span className="font-mono text-xs">{i.code}</span> },
          { key: 'name', header: 'Name', render: (i) => <span className="font-medium">{i.name}</span> },
          { key: 'uom', header: 'UOM', render: (i) => i.uom },
          { key: 'cost', header: 'Cost', align: 'right', render: (i) => fmt(i.cost) },
          { key: 'price', header: 'Price', align: 'right', render: (i) => fmt(i.price) },
          {
            key: 'onHand',
            header: 'On Hand',
            align: 'right',
            render: (i) => (
              <span className={i.onHand <= i.reorderLevel ? 'font-semibold text-amber-700' : ''}>{i.onHand}</span>
            ),
          },
          { key: 'reorder', header: 'Reorder', align: 'right', render: (i) => i.reorderLevel },
          {
            key: 'classification',
            header: 'Class',
            render: (i) => i.classification ?? '—',
          },
          {
            key: 'status',
            header: 'Status',
            render: (i) => <Badge tone={i.active ? 'success' : 'default'}>{i.active ? 'Active' : 'Inactive'}</Badge>,
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (i) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(i)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirm(`Delete ${i.name}?`) && remove.mutate(i.id)}
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
        title={editing ? 'Edit Item' : 'New Item'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button loading={upsert.isPending} onClick={form.handleSubmit((d) => upsert.mutate(d))}>
              {editing ? 'Save changes' : 'Create item'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((d) => upsert.mutate(d))}>
          <Field label="Code" required>
            <Input {...form.register('code')} placeholder="ITEM-001" />
          </Field>
          <Field label="Name" required>
            <Input {...form.register('name')} placeholder="Standard Widget" />
          </Field>
          <Field label="UOM" hint="Unit of Measure (PCS, HOUR, KG…)" required>
            <Input {...form.register('uom')} />
          </Field>
          <Field label="Classification" hint="MyInvois classification code">
            <Input {...form.register('classification')} />
          </Field>
          <Field label="Cost" hint="Per unit cost">
            <Input type="number" step="0.0001" {...form.register('cost', { valueAsNumber: true })} />
          </Field>
          <Field label="Selling Price">
            <Input type="number" step="0.0001" {...form.register('price', { valueAsNumber: true })} />
          </Field>
          <Field label="On Hand">
            <Input type="number" step="0.0001" {...form.register('onHand', { valueAsNumber: true })} />
          </Field>
          <Field label="Reorder Level">
            <Input type="number" step="0.0001" {...form.register('reorderLevel', { valueAsNumber: true })} />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <Input {...form.register('description')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
