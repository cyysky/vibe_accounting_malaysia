'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, Scale } from 'lucide-react';
import { api } from '../../lib/api';

const fmt = (n: number) => (n ?? 0).toLocaleString('en-MY', { style: 'currency', currency: 'MYR' });

export default function ReportsPage() {
  const pnl = useQuery({ queryKey: ['pnl'], queryFn: () => api.pnl() });
  const bs = useQuery({ queryKey: ['bs'], queryFn: () => api.balanceSheet() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financial Reports</h1>
        <p className="text-sm text-slate-500">Profit &amp; loss and balance sheet at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Revenue
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{fmt(pnl.data?.revenue ?? 0)}</div>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <TrendingDown className="h-4 w-4 text-rose-600" /> Expenses
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{fmt(pnl.data?.expenses ?? 0)}</div>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <Wallet className="h-4 w-4 text-brand-600" /> Net Income
          </div>
          <div className={`mt-2 text-2xl font-semibold tabular-nums ${(pnl.data?.netIncome ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {fmt(pnl.data?.netIncome ?? 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
            <Scale className="h-4 w-4 text-sky-600" /> Assets
          </div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(bs.data?.assets ?? 0)}</div>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="text-xs uppercase text-slate-500">Liabilities</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(bs.data?.liabilities ?? 0)}</div>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="text-xs uppercase text-slate-500">Equity</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{fmt(bs.data?.equity ?? 0)}</div>
        </div>
        <div className={`rounded-lg border p-5 shadow-sm ${bs.data?.balanced ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <div className="text-xs uppercase text-slate-500">Balance Check</div>
          <div className={`mt-2 text-xl font-semibold ${bs.data?.balanced ? 'text-emerald-700' : 'text-rose-700'}`}>
            {bs.data?.balanced ? 'Balanced ✓' : 'Out of balance'}
          </div>
        </div>
      </div>
    </div>
  );
}
