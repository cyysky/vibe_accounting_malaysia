'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Item } from '@account/shared';

export default function StockPage() {
  const { data, isLoading } = useQuery({ queryKey: ['items'], queryFn: () => api.items<Item>() });
  if (isLoading) return <p>Loading…</p>;
  const items = (data ?? []) as Item[];
  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'MYR' });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Stock</h1>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th>Name</th>
              <th>UOM</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Price</th>
              <th className="text-right">On Hand</th>
              <th className="text-right">Reorder</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={`border-t ${i.onHand <= i.reorderLevel ? 'bg-amber-50' : ''}`}>
                <td className="px-4 py-2 font-mono">{i.code}</td>
                <td>{i.name}</td>
                <td>{i.uom}</td>
                <td className="text-right">{fmt(i.cost)}</td>
                <td className="text-right">{fmt(i.price)}</td>
                <td className="text-right">{i.onHand}</td>
                <td className="text-right">{i.reorderLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
