'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  BookOpen,
  ScrollText,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  ShoppingBag,
  Package,
  BarChart3,
  Settings,
} from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/books', label: 'Chart of Accounts', icon: BookOpen },
  { href: '/dashboard/journal', label: 'Journal Entry', icon: ScrollText },
  { href: '/receivables', label: 'Receivables (AR)', icon: ArrowDownLeft },
  { href: '/payables', label: 'Payables (AP)', icon: ArrowUpRight },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/purchase', label: 'Purchase', icon: ShoppingBag },
  { href: '/stock', label: 'Stock', icon: Package },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings/books', label: 'Account Books', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r bg-white">
      <div className="flex h-14 items-center px-4 text-lg font-semibold text-brand-700">
        Vibe Accounting
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = path === item.href || path?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
