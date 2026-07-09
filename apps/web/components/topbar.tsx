'use client';

import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export function Topbar() {
  const router = useRouter();
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div className="text-sm text-slate-500">
        Vibe Accounting Malaysia
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" /> admin@example.com
        </div>
        <button
          onClick={() => {
            api.setToken(null);
            router.push('/login');
          }}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </header>
  );
}
