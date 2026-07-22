'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createIDBPersister } from '@/lib/react-query/idbPersister';
import {
  portalQueryStorageKey,
  resolvePortalQueryCacheBuster,
  shouldDehydratePortalQuery,
} from '@/lib/react-query/persistence';
import LocalFirstRuntime from '@/components/sync/LocalFirstRuntime';
import LocalFirstPortalMutations from '@/components/sync/LocalFirstPortalMutations';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';

const ONE_DAY = 1000 * 60 * 60 * 24;

function createPortalQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: ONE_DAY,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

function PortalDataBoundary({ children, ownerId }: { children: ReactNode; ownerId: string | null }) {
  const [queryClient] = useState(createPortalQueryClient);
  const [persister] = useState(() => ownerId ? createIDBPersister(portalQueryStorageKey(ownerId)) : null);
  const buster = resolvePortalQueryCacheBuster(process.env.NEXT_PUBLIC_QUERY_CACHE_BUSTER);

  useEffect(() => () => queryClient.clear(), [queryClient]);

  const content = (
    <PortalQueryClientScope client={queryClient}>
      {ownerId ? <LocalFirstRuntime ownerId={ownerId} /> : null}
      {ownerId ? <LocalFirstPortalMutations /> : null}
      {children}
      {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </PortalQueryClientScope>
  );

  if (!ownerId || !persister) {
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY,
        buster,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydratePortalQuery,
        },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const { status, user } = usePortalSession();
  const ownerId = status === 'authenticated' ? user?.id ?? null : null;
  return (
    <PortalDataBoundary key={ownerId ?? 'anonymous'} ownerId={ownerId}>
      {children}
    </PortalDataBoundary>
  );
}
