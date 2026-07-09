'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, ScrollText } from 'lucide-react';
import { api, type Account } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Field, Input, Textarea, Badge } from '../../../components/ui/Form';

const lineSchema = z.object({
  accountId: z.string().min(1, 'Required'),
  description: z.string().optional(),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
});

const journalSchema = z.object({
  date: z.string().min(1, 'Required'),
  description: z.string().min(1, 'Required'),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(2, 'At least two lines required'),
});
type JournalForm = z.infer<typeof journalSchema>;

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });

export default function JournalPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounts() });
  const journals = useQuery({ queryKey: ['journals'], queryFn: () => api.journals() });

  const form = useForm<JournalForm>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      date: today,
      description: '',
      reference: '',
      lines: [
        { accountId: '', debit: 0, credit: 0 },
        { accountId: '', debit: 0, credit: 0 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const lines = form.watch('lines');

  const totals = useMemo(
    () => lines.reduce(
      (acc, l) => ({
        debit: acc.debit + Number(l.debit ?? 0),
        credit: acc.credit + Number(l.credit ?? 0),
      }),
      { debit: 0, credit: 0 },
    ),
    [lines],
  );
  const balanced = Math.abs(totals.debit - totals.credit) < 0.001;

  const create = useMutation({
    mutationFn: (data: JournalForm) => api.createJournal(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      form.reset({ date: today, description: '', reference: '', lines: [{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }] });
    },
  });

  function openCreate() {
    form.reset({
      date: today,
      description: '',
      reference: '',
      lines: [
        { accountId: '', debit: 0, credit: 0 },
        { accountId: '', debit: 0, credit: 0 },
      ],
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal Entries</h1>
          <p className="text-sm text-slate-500">Manual journal vouchers. Must balance.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Journal
        </Button>
      </div>

      <DataTable
        data={journals.data?.data ?? []}
        loading={journals.isLoading}
        rowKey={(j) => j.id}
        empty="No journal entries yet."
        columns={[
          { key: 'number', header: 'Number', render: (j) => <span className="font-mono text-xs">{j.number}</span> },
          { key: 'date', header: 'Date', render: (j) => j.date },
          { key: 'description', header: 'Description', render: (j) => j.description },
          {
            key: 'status',
            header: 'Status',
            render: (j) => <Badge tone={j.status === 'POSTED' ? 'success' : 'warning'}>{j.status}</Badge>,
          },
          { key: 'debit', header: 'Debit', align: 'right', render: (j) => fmt(j.totalDebit) },
          { key: 'credit', header: 'Credit', align: 'right', render: (j) => fmt(j.totalCredit) },
        ]}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Journal Entry"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!balanced}
              onClick={form.handleSubmit((d) => create.mutate(d))}
            >
              Post journal
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((d) => create.mutate(d))}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Date" required>
              <Input type="date" {...form.register('date')} />
            </Field>
            <Field label="Description" required className="md:col-span-2">
              <Input {...form.register('description')} placeholder="Opening balance / Adjustment / etc." />
            </Field>
            <Field label="Reference" className="md:col-span-3">
              <Input {...form.register('reference')} placeholder="Optional reference / source doc" />
            </Field>
          </div>

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, idx) => (
                  <tr key={f.id} className="border-t">
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        {...form.register(`lines.${idx}.accountId`)}
                      >
                        <option value="">Select account…</option>
                        {(accounts.data ?? []).map((a: Account) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input {...form.register(`lines.${idx}.description`)} placeholder="Memo" />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right tabular-nums"
                        {...form.register(`lines.${idx}.debit`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right tabular-nums"
                        {...form.register(`lines.${idx}.credit`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {fields.length > 2 && (
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-600"
                          onClick={() => remove(idx)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50 text-sm font-semibold">
                  <td className="px-3 py-2" colSpan={2}>
                    Totals {balanced ? <Badge tone="success">Balanced</Badge> : <Badge tone="danger">Out of balance</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.debit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.credit)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="border-t px-3 py-2">
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => append({ accountId: '', debit: 0, credit: 0 })}
              >
                <Plus className="h-4 w-4" /> Add line
              </Button>
            </div>
          </div>

          {create.error && <p className="text-sm text-rose-600">{(create.error as Error).message}</p>}
        </form>
      </Modal>
    </div>
  );
}
