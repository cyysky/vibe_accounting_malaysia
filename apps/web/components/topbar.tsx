'use client';

import { LogOut, User, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import type { AuthUser } from '../lib/api';

export function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUser(api.getUser());
  }, []);

  function logout() {
    api.logout();
    router.push('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="hidden md:inline">Vibe Accounting Malaysia</span>
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
