'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { Topbar } from '../components/topbar';
import { api } from '../lib/api';

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = api.loadToken();
    if (!token && pathname !== '/login') {
      router.replace('/login');
    }
  }, [pathname, router]);

  if (pathname === '/login') return <>{children}</>;
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
