'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));

  useEffect(() => {
    api.loadToken();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
