'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function ReportsPage() {
  const pnl = useQuery({ queryKey: ['pnl'], queryFn: () => api.pnl() });
  const bs = useQuery({ queryKey: ['bs'], queryFn: () => api.balanceSheet() });
  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'MYR' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Financial Reports</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Profit & Loss</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr><td>Revenue</td><td className="text-right">{fmt(pnl.data?.revenue ?? 0)}</td></tr>
              <tr><td>Expenses</td><td className="text-right">({fmt(pnl.data?.expenses ?? 0)})</td></tr>
              <tr className="border-t font-semibold">
                <td className="py-2">Net Income</td>
                <td className="py-2 text-right">{fmt(pnl.data?.netIncome ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Balance Sheet</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr><td>Assets</td><td className="text-right">{fmt(bs.data?.assets ?? 0)}</td></tr>
              <tr><td>Liabilities</td><td className="text-right">{fmt(bs.data?.liabilities ?? 0)}</td></tr>
              <tr><td>Equity</td><td className="text-right">{fmt(bs.data?.equity ?? 0)}</td></tr>
              <tr className="border-t font-semibold">
                <td className="py-2">Balanced?</td>
                <td className="py-2 text-right">
                  {bs.data?.balanced ? <span className="text-green-600">Yes</span> : <span className="text-red-600">No</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
