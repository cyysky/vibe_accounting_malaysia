"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
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
  FileCheck2,
  Receipt,
  Users,
  Calculator,
  CalendarRange,
  Building2,
  Repeat,
  Wallet,
  Activity,
  FileMinus2,
  FilePlus2,
} from "lucide-react";

const sections = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/audit-log", label: "Activity", icon: Activity },
    ],
  },
  {
    title: "Accounting",
    items: [
      { href: "/dashboard/books", label: "Chart of Accounts", icon: BookOpen },
      { href: "/dashboard/journal", label: "Journal Entry", icon: ScrollText },
      { href: "/reports", label: "Financial Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Receivables",
    items: [
      { href: "/receivables", label: "Customer Invoices", icon: ArrowDownLeft },
      { href: "/receivables/payments", label: "Customer Payments", icon: Wallet },
      { href: "/receivables/credit-notes", label: "Credit Notes", icon: FileMinus2 },
    ],
  },
  {
    title: "Payables",
    items: [
      { href: "/payables", label: "Supplier Bills", icon: ArrowUpRight },
      { href: "/payables/payments", label: "Supplier Payments", icon: Wallet },
      { href: "/payables/debit-notes", label: "Debit Notes", icon: FilePlus2 },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/sales", label: "Sales Orders", icon: ShoppingCart },
      { href: "/purchase", label: "Purchase Orders", icon: ShoppingBag },
      { href: "/stock", label: "Stock / Items", icon: Package },
      { href: "/recurring", label: "Recurring Invoices", icon: Repeat },
    ],
  },
  {
    title: "LHDNM e-Invoice",
    items: [
      { href: "/einvoice/configs", label: "MyInvois Config", icon: Settings },
      { href: "/einvoice/submissions", label: "Submissions", icon: FileCheck2 },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/settings/books", label: "Account Books", icon: Building2 },
      { href: "/settings/tax-codes", label: "Tax Codes", icon: Calculator },
      { href: "/settings/fiscal-years", label: "Fiscal Years", icon: CalendarRange },
      { href: "/settings/bank-accounts", label: "Bank Accounts", icon: Wallet },
      { href: "/settings/users", label: "Users & Roles", icon: Users },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Receipt className="h-5 w-5 text-brand-600" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">Vibe Accounting</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Malaysia</div>
        </div>
      </div>
      <nav className="flex flex-col gap-4 overflow-y-auto p-3 text-sm">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = path === item.href || path?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                      active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
