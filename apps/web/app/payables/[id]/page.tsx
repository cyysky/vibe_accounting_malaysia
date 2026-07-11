'use client';

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Wallet, FilePlus2, Receipt } from "lucide-react";
import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString('en-MY') : '\u2014');

interface BillLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxCodeId?: string;
  taxAmount?: number;
  subtotal?: number;
  total?: number;
  lineNo?: number;
}

interface Bill {
  id: string;
  number: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  dueDate: string;
  currency: string;
  subtotal: number | string;
  taxTotal?: number | string;
  tax?: number | string;
  total: number | string;
  paid?: number | string;
  balance?: number | string;
  status: string;
  lines?: BillLine[];
}

export default function BillDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const bill = useQuery({ queryKey: ['supplierInvoice', id], queryFn: () => api.getSupplierInvoice(id) as Promise<Bill> });
  const auditQ = useQuery({ queryKey: ['audit-bill', id], queryFn: () => api.auditLogFor('SupplierInvoice', id) });
  const paymentsQ = useQuery({ queryKey: ['bill-payments', id], queryFn: () => api.paymentsByBill(id) });

  if (bill.isLoading) return <p className={'p-8 text-slate-500'}>Loading bill…</p>;
  if (bill.error) return <p className={'p-8 text-rose-600'}>Failed to load: {(bill.error as Error).message}</p>;
  const inv = bill.data!;
  const lines = inv.lines ?? [];

  return (
    <div>
      <PageHeader
        title={'Bill ' + inv.number}
        description={'Supplier: ' + (inv.supplierName ?? inv.supplierId)}
        descriptionHref={'/payables/suppliers/' + inv.supplierId}
        breadcrumbs={[{ label: 'Payables', href: '/payables' }, { label: inv.number ?? '' }]}
        actions={
          <div className='flex items-center gap-2'>
            <StatusBadge status={inv.status} />
            <Link href={'/payables/payments?supplierId=' + inv.supplierId}>
              <Button variant='secondary'><Wallet className='h-4 w-4' /> Record payment</Button>
            </Link>
            <Link href={'/payables/debit-notes?supplierId=' + inv.supplierId}>
              <Button variant='secondary'><FilePlus2 className='h-4 w-4' /> Issue debit note</Button>
            </Link>
            <Link href='/payables'>
              <Button variant='ghost'><ArrowLeft className='h-4 w-4' /> Back to payables</Button>
            </Link>
          </div>
        }
      />

      <div className='grid grid-cols-2 gap-4 md:grid-cols-5'>
        <Stat label='Date' value={inv.date} />
        <Stat label='Due' value={inv.dueDate} />
        <Stat label='Subtotal' value={fmt(Number(inv.subtotal ?? 0))} />
        <Stat label='Tax' value={fmt(Number(inv.taxTotal ?? inv.tax ?? 0))} />
        <Stat label='Total' value={fmt(Number(inv.total ?? 0))} bold />
        <Stat label='Paid' value={fmt(Number(inv.paid ?? 0))} />
        <Stat label='Balance' value={fmt(Number(inv.balance ?? 0))} bold />
        <Stat label='Currency' value={inv.currency ?? 'MYR'} />
      </div>

      <div className='mt-6 rounded-lg border bg-white shadow-sm'>
        <div className='flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700'>
          <Receipt className='h-4 w-4' /> Lines
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500'>
              <tr>
                <th className='px-4 py-2'>#</th>
                <th className='px-4 py-2'>Description</th>
                <th className='px-4 py-2 text-right'>Qty</th>
                <th className='px-4 py-2 text-right'>Price</th>
                <th className='px-4 py-2 text-right'>Disc.</th>
                <th className='px-4 py-2 text-right'>Tax</th>
                <th className='px-4 py-2 text-right'>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.id ?? idx} className='border-t'>
                  <td className='px-4 py-2 text-slate-400'>{l.lineNo ?? idx + 1}</td>
                  <td className='px-4 py-2'>{l.description}</td>
                  <td className='px-4 py-2 text-right tabular-nums'>{Number(l.quantity).toLocaleString('en-MY')}</td>
                  <td className='px-4 py-2 text-right tabular-nums'>{fmt(Number(l.unitPrice))}</td>
                  <td className='px-4 py-2 text-right tabular-nums'>{fmt(Number(l.discount ?? 0))}</td>
                  <td className='px-4 py-2 text-right tabular-nums'>{fmt(Number(l.taxAmount ?? 0))}</td>
                  <td className='px-4 py-2 text-right font-medium tabular-nums'>{fmt(Number(l.total ?? 0))}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={7} className='px-4 py-6 text-center text-slate-500'>No lines.</td></tr>
              )}
            </tbody>
            <tfoot className='border-t bg-slate-50'>
              <tr><td colSpan={6} className='px-4 py-2 text-right text-sm'>Subtotal</td><td className='px-4 py-2 text-right'>{fmt(Number(inv.subtotal ?? 0))}</td></tr>
              <tr><td colSpan={6} className='px-4 py-2 text-right text-sm'>Tax</td><td className='px-4 py-2 text-right'>{fmt(Number(inv.taxTotal ?? inv.tax ?? 0))}</td></tr>
              <tr><td colSpan={6} className='px-4 py-2 text-right text-base font-semibold'>Total</td><td className='px-4 py-2 text-right text-base font-semibold'>{fmt(Number(inv.total ?? 0))}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      {(paymentsQ.data ?? []).length > 0 && (
        <div className="mt-6 rounded-lg border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold text-slate-700">
            <Wallet className="h-4 w-4" /> Payments applied
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Payment #</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2 text-right">Applied</th>
                </tr>
              </thead>
              <tbody>
                {paymentsQ.data!.flatMap((p) =>
                  p.applications
                    .filter((a) => a.invoiceId === id)
                    .map((a) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-4 py-2"><span className="font-mono text-xs">{p.number}</span></td>
                        <td className="px-4 py-2">{p.date}</td>
                        <td className="px-4 py-2">{p.method}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmt(Number(a.amount))}</td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(auditQ.data ?? []).length > 0 && (
        <div className='mt-6 rounded-lg border bg-white p-4 text-sm'>
          <h3 className='mb-2 font-semibold text-slate-700'>Activity</h3>
          <ol className='space-y-1 text-slate-600'>
            {auditQ.data!.map((e) => (
              <li key={e.id} className='flex items-center gap-2'>
                <StatusBadge status={e.action === 'CREATE' ? 'ISSUED' : e.action === 'UPDATE' ? 'DRAFT' : 'CANCELLED'} />
                <span>{e.action}</span>
                {e.user && <span className='text-slate-400'>by {e.user.name ?? e.user.email}</span>}
                <time className='ml-auto text-xs text-slate-400'>{fmtDate(e.createdAt)}</time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className='rounded-lg border bg-white p-4'>
      <div className='text-xs uppercase text-slate-500'>{label}</div>
      <div className={'mt-1 ' + (bold ? 'text-lg font-semibold' : 'text-base') + ' tabular-nums'}>{value}</div>
    </div>
  );
}

