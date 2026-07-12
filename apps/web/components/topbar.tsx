'use client';

import { LogOut, User, ChevronDown, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AuthUser } from '../lib/api';


type SearchHit =
  | { kind: 'customer'; id: string; label: string; sub?: string; href: string }
  | { kind: 'supplier'; id: string; label: string; sub?: string; href: string }
  | { kind: 'item'; id: string; label: string; sub?: string; href: string }
  | { kind: 'invoice'; id: string; label: string; sub?: string; href: string }
  | { kind: 'bill'; id: string; label: string; sub?: string; href: string }
  | { kind: 'journal'; id: string; label: string; sub?: string; href: string }
  | { kind: 'creditNote'; id: string; label: string; sub?: string; href: string }
  | { kind: 'debitNote'; id: string; label: string; sub?: string; href: string }
  | { kind: 'salesOrder'; id: string; label: string; sub?: string; href: string }
  | { kind: 'purchaseOrder'; id: string; label: string; sub?: string; href: string }
  | { kind: 'bankAccount'; id: string; label: string; sub?: string; href: string };

interface SearchResults {
  customers: Array<{ id: string; name: string; code: string }>;
  suppliers: Array<{ id: string; name: string; code: string }>;
  items: Array<{ id: string; name: string; code: string }>;
  invoices: Array<{ id: string; number: string; customer: { name: string } }>;
  bills: Array<{ id: string; number: string; supplier: { name: string } }>;
  journals: Array<{ id: string; number: string; description?: string | null }>;
  creditNotes: Array<{ id: string; number: string; reason?: string | null }>;
  debitNotes: Array<{ id: string; number: string; reason?: string | null }>;
  salesOrders: Array<{ id: string; number: string }>;
  purchaseOrders: Array<{ id: string; number: string }>;
  bankAccounts: Array<{ id: string; name: string; bankName?: string | null }>;
}

export function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUser(api.getUser());
  }, []);

  // API liveness probe — small dot in the topbar turns red on failure.
  const healthQ = useQuery({
    queryKey: ["topbar-health"],
    queryFn: () => api.health(),
    refetchInterval: 30_000,
    retry: false,
  });

  // Cmd/Ctrl-K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Auto-scroll the active result into view as the user arrows up/down.
  useEffect(() => {
    const el = searchRef.current?.querySelector<HTMLElement>(`[data-result-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const searchQ = useQuery({
    queryKey: ['topbar-search', searchTerm],
    queryFn: () => api.dashboardSearch(searchTerm),
    enabled: searchTerm.length >= 2,
    staleTime: 30_000,
  });

  function logout() {
    api.logout();
    router.push('/login');
  }

  const results: SearchHit[] = (() => {
    const r = (searchQ.data ?? null) as SearchResults | null;
    if (!r) return [];
    const out: SearchHit[] = [];
    for (const c of r.customers) {
      out.push({ kind: 'customer', id: c.id, label: c.name, sub: c.code, href: `/receivables/customers/${c.id}` });
    }
    for (const c of r.suppliers) {
      out.push({ kind: 'supplier', id: c.id, label: c.name, sub: c.code, href: `/payables/suppliers/${c.id}` });
    }
    for (const i of r.items) {
      out.push({ kind: 'item', id: i.id, label: i.name, sub: i.code, href: `/stock/${i.id}` });
    }
    for (const inv of r.invoices) {
      out.push({ kind: 'invoice', id: inv.id, label: inv.number, sub: inv.customer?.name, href: `/receivables/${inv.id}` });
    }
    for (const bill of r.bills) {
      out.push({ kind: 'bill', id: bill.id, label: bill.number, sub: bill.supplier?.name, href: `/payables/${bill.id}` });
    }
    for (const j of r.journals) {
      out.push({ kind: 'journal', id: j.id, label: j.number, sub: j.description ?? undefined, href: `/dashboard/journal/${j.id}` });
    }
    for (const cn of r.creditNotes ?? []) {
      out.push({ kind: 'creditNote', id: cn.id, label: cn.number, sub: cn.reason ?? undefined, href: `/receivables/credit-notes/${cn.id}` });
    }
    for (const dn of r.debitNotes ?? []) {
      out.push({ kind: 'debitNote', id: dn.id, label: dn.number, sub: dn.reason ?? undefined, href: `/payables/debit-notes/${dn.id}` });
    }
    for (const so of r.salesOrders ?? []) {
      out.push({ kind: 'salesOrder', id: so.id, label: so.number, href: `/sales/${so.id}` });
    }
    for (const po of r.purchaseOrders ?? []) {
      out.push({ kind: 'purchaseOrder', id: po.id, label: po.number, href: `/purchase/${po.id}` });
    }
    for (const ba of r.bankAccounts ?? []) {
      out.push({ kind: 'bankAccount', id: ba.id, label: ba.name, sub: ba.bankName ?? undefined, href: `/settings/bank-accounts/${ba.id}` });
    }
    return out;
  })();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-3">
        <span className="hidden md:inline text-sm text-slate-500">Vibe Accounting Malaysia</span>
        {healthQ.data && (
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
              (healthQ.isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")
            }
            title={healthQ.isError ? "API unreachable" : "API OK — v" + (healthQ.data?.version ?? "?")}
          >
            <span className={"h-1.5 w-1.5 rounded-full " + (healthQ.isError ? "bg-rose-500" : "bg-emerald-500")} />
            {healthQ.isError ? "Offline" : "Online"}
          </span>
        )}
      </div>

      <div className="relative flex-1 max-w-md" ref={searchRef}>
        <button
          className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          onClick={() => setSearchOpen((v) => !v)}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search customers, invoices, items…</span>
          <span className="hidden rounded border bg-white px-1 text-[10px] text-slate-400 md:inline">⌘K</span>
        </button>
        {searchOpen && (
          <div className="absolute right-0 left-0 z-30 mt-2 rounded-md border bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setActiveIdx(0); }}
                placeholder="Type to search…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  onKeyDown={(e) => {
                    if (results.length === 0) return;
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % results.length); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => (i - 1 + results.length) % results.length); }
                    else if (e.key === 'Enter') { e.preventDefault(); const r = results[activeIdx]; if (r) { setSearchOpen(false); setSearchTerm(''); router.push(r.href); } }
                  }}
                />
              {searchQ.isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              {searchTerm.length >= 2 && results.length > 0 && <span className="text-[10px] text-slate-400">↑↓ to move · ↵ to open</span>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchTerm.length < 2 && (
                <p className="px-4 py-6 text-center text-xs text-slate-500">Type at least 2 characters…</p>
              )}
              {searchTerm.length >= 2 && results.length === 0 && !searchQ.isFetching && (
                <p className="px-4 py-6 text-center text-xs text-slate-500">No matches.</p>
              )}
              {results.length > 0 && (
                <ul className="divide-y">
                  {results.map((hit, idx) => {
                    const prev = idx === 0 ? null : results[idx - 1];
                    const showHeader = !prev || prev.kind !== hit.kind;
                    const headerLabel: Record<SearchHit['kind'], string> = {
                      customer: 'Customers',
                      supplier: 'Suppliers',
                      item: 'Items',
                      invoice: 'Invoices',
                      bill: 'Bills',
                      journal: 'Journals',
                      creditNote: 'Credit Notes',
                      debitNote: 'Debit Notes',
                      salesOrder: 'Sales Orders',
                      purchaseOrder: 'Purchase Orders',
                      bankAccount: 'Bank Accounts',
                    };
                    return (
                      <li key={`${hit.kind}-${hit.id}-${idx}`} data-result-idx={idx}>
                        {showHeader && (
                          <div className="bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {headerLabel[hit.kind]}
                          </div>
                        )}
                        <Link
                          href={hit.href}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchTerm('');
                          }}
                          className={'flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 ' + (idx === activeIdx ? 'bg-brand-50' : '')}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">{hit.label}</div>
                            {hit.sub && <div className="truncate text-xs text-slate-500">{hit.sub}</div>}
                          </div>
                          <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">{hit.kind}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          <User className="h-4 w-4" />
          <span>{user?.email ?? 'Guest'}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">{user?.role ?? '-'}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded-md border bg-white py-1 shadow-lg">
            <div className="border-b px-3 py-2 text-xs text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{user?.name ?? user?.email}</span>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
