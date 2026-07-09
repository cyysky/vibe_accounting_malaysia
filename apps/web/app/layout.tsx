import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '../components/providers';
import { ProtectedShell } from '../components/ProtectedShell';

export const metadata: Metadata = {
  title: 'Vibe Accounting Malaysia',
  description: 'Vibe Accounting Malaysia — cloud-native accounting for Malaysian businesses',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <ProtectedShell>{children}</ProtectedShell>
        </Providers>
      </body>
    </html>
  );
}
