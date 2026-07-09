import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '../components/providers';
import { Sidebar } from '../components/sidebar';
import { Topbar } from '../components/topbar';

export const metadata: Metadata = {
  title: 'Vibe Accounting Malaysia',
  description: 'Vibe Accounting Malaysia — cloud-native accounting for Malaysian businesses',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col">
              <Topbar />
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
