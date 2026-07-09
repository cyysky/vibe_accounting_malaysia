'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Supplier } from '@account/shared';

export default function PayablesPage() {
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.suppliers() });
  const invoices = useQuery({ queryKey: ['ap-invoices'], queryFn: () => api.supplierInvoices() });
  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'MYR' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Payables</h1>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Suppliers</h2>
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th>Name</th>
                <th>Currency</th>
                <th className="text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {(suppliers.data ?? []).map((s: Supplier) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2 font-mono">{s.code}</td>
                  <td>{s.name}</td>
                  <td>{s.currency}</td>
                  <td className="text-right">{fmt(s.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Bills</h2>
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th>Supplier</th>
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
                  <td>{i.supplierName}</td>
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
