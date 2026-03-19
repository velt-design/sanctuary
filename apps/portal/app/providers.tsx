'use client';

import { ReactNode, useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createIDBPersister } from '@/lib/react-query/idbPersister';
import LocalFirstRuntime from '@/components/sync/LocalFirstRuntime';
import LocalFirstPortalMutations from '@/components/sync/LocalFirstPortalMutations';

const ONE_DAY = 1000 * 60 * 60 * 24;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: ONE_DAY,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const [persister] = useState(() => createIDBPersister('sanctuary-portal-react-query'));
  const buster = process.env.NEXT_PUBLIC_QUERY_CACHE_BUSTER ?? 'v2';

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY,
        buster,
      }}
    >
      <LocalFirstRuntime />
      <LocalFirstPortalMutations />
      {children}
      {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </PersistQueryClientProvider>
  );
}
