'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { JournalEntry } from '@account/shared';

export default function JournalPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['journals'],
    queryFn: () => api.journals(),
  });
  if (isLoading) return <p>Loading…</p>;
  const list = data?.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Journal Entries</h1>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Number</th>
              <th>Date</th>
              <th>Description</th>
              <th>Status</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {list.map((j: JournalEntry) => (
              <tr key={j.id} className="border-t">
                <td className="px-4 py-2 font-mono">{j.number}</td>
                <td>{j.date}</td>
                <td>{j.description}</td>
                <td>{j.status}</td>
                <td className="text-right">{j.totalDebit.toFixed(2)}</td>
                <td className="text-right">{j.totalCredit.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
