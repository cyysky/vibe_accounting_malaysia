'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { AccountBook } from '@account/shared';

export default function AccountBooksPage() {
  const { data, isLoading } = useQuery({ queryKey: ['books'], queryFn: () => api.accountBooks() });
  if (isLoading) return <p>Loading…</p>;
  const books = (data ?? []) as AccountBook[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Account Books</h1>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th>Name</th>
              <th>Base Currency</th>
              <th>FY Start Month</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-4 py-2 font-mono">{b.code}</td>
                <td>{b.name}</td>
                <td>{b.baseCurrency}</td>
                <td>{b.fiscalYearStartMonth}</td>
                <td>{b.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
