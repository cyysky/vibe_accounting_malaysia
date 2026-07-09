'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Customer } from '@account/shared';

export default function ReceivablesPage() {
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api.customers() });
  const invoices = useQuery({ queryKey: ['ar-invoices'], queryFn: () => api.customerInvoices() });
  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'MYR' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Receivables</h1>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Customers</h2>
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th>Name</th>
                <th>Currency</th>
                <th className="text-right">Credit Limit</th>
                <th className="text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {(customers.data ?? []).map((c: Customer) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-mono">{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.currency}</td>
                  <td className="text-right">{fmt(c.creditLimit)}</td>
                  <td className="text-right">{fmt(c.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Invoices</h2>
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Due</th>
                <th className="text-right">Total</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(invoices.data?.data ?? []).map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-2 font-mono">{i.number}</td>
                  <td>{i.customerName}</td>
                  <td>{i.date}</td>
                  <td>{i.dueDate}</td>
                  <td className="text-right">{fmt(i.total)}</td>
                  <td className="text-right">{fmt(i.balance)}</td>
                  <td>{i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
