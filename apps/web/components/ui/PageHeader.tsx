"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  href?: string;
  label: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={clsx("mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4", className)}>
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-xs text-slate-500">
            <Link href="/dashboard" className="flex items-center gap-1 hover:text-slate-700">
              <Home className="h-3 w-3" /> Home
            </Link>
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                {b.href ? (
                  <Link href={b.href} className="hover:text-slate-700">
                    {b.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-700">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
