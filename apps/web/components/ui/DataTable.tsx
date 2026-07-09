'use client';

import clsx from 'clsx';
import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ data, columns, rowKey, empty, loading, onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={clsx('px-4 py-3 font-medium', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Loading…
                </div>
              </td>
            </tr>
          )}
          {!loading && data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                {empty ?? 'No data yet.'}
              </td>
            </tr>
          )}
          {!loading &&
            data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={clsx('border-t border-slate-100 transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx('px-4 py-3', c.align === 'right' && 'text-right tabular-nums', c.align === 'center' && 'text-center', c.className)}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
