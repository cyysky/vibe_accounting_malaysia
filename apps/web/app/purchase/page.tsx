'use client';

import { useQuery } from '@tanstack/react-query';
import type { PurchaseOrder } from './purchase.types';

export default function PurchasePage() {
  const { data, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: () => fetch('http://localhost:3001/api/purchase/orders', {
      headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : ''}` },
    }).then((r) => r.json()),
  });
  if (isLoading) return <p>Loading…</p>;
  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'MYR' });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Purchase Orders</h1>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="px-4 py-2">Number</th><th>Supplier</th><th>Date</th><th className="text-right">Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2 font-mono">{o.number}</td>
                <td>{o.supplierName}</td>
                <td>{o.date}</td>
                <td className="text-right">{fmt(o.total)}</td>
                <td>{o.status}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No purchase orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
