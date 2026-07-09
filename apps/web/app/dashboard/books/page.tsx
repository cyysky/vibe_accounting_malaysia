'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { Account } from '@account/shared';

export default function BooksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts(),
  });
  if (isLoading) return <p>Loading…</p>;
  const accounts = (data ?? []) as Account[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Currency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2 font-mono">{a.code}</td>
                <td>{a.name}</td>
                <td>{a.type}</td>
                <td>{a.currency}</td>
                <td>{a.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
