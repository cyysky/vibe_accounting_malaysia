'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface SalesOrder { id: string; number: string; customerName?: string; date: string; total: number; status: string }

export default function SalesPage() {
  const { data, isLoading } = useQuery<SalesOrder[]>({
    queryKey: ['sales-orders'],
    queryFn: () => fetch('http://localhost:3001/api/sales/orders', {
      headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : ''}` },
    }).then((r) => r.json()),
  });
  if (isLoading) return <p>Loading…</p>;
  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'MYR' });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sales Orders</h1>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="px-4 py-2">Number</th><th>Customer</th><th>Date</th><th className="text-right">Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2 font-mono">{o.number}</td>
                <td>{o.customerName}</td>
                <td>{o.date}</td>
                <td className="text-right">{fmt(o.total)}</td>
                <td>{o.status}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No sales orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
