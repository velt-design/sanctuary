'use client';

import { type ReactNode, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import LocalFirstRuntime from '@/components/sync/LocalFirstRuntime';
import LocalFirstPortalMutations from '@/components/sync/LocalFirstPortalMutations';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { PortalQueryClientScope } from '@/lib/react-query/PortalQueryClientContext';
import PortalThemeRuntime from '@/components/theme/PortalThemeRuntime';
import PortalCoreShellPreloader from '@/components/offline/PortalCoreShellPreloader';

const PortalAuthenticatedOfflineRuntime = dynamic(
  () => import('@/components/offline/PortalAuthenticatedOfflineRuntime'),
  { loading: () => null, ssr: false },
);

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

  useEffect(() => () => queryClient.clear(), [queryClient]);

  const content = (
    <PortalQueryClientScope client={queryClient}>
      {ownerId ? <LocalFirstRuntime ownerId={ownerId} /> : null}
      {ownerId ? <LocalFirstPortalMutations /> : null}
      {ownerId ? <PortalCoreShellPreloader /> : null}
      {ownerId ? (
        <PortalAuthenticatedOfflineRuntime
          version={process.env.NEXT_PUBLIC_PORTAL_STATIC_CACHE_VERSION ?? ''}
          enabled={process.env.NODE_ENV === 'production'}
        />
      ) : null}
      {children}
      {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </PortalQueryClientScope>
  );

  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const { status, user, role } = usePortalSession();
  const ownerId = status === 'authenticated' ? user?.id ?? null : null;
  const presentationOwnerId = status === 'loading' || status === 'authenticated'
    ? user?.id ?? null
    : null;
  return (
    <>
      {presentationOwnerId ? <PortalThemeRuntime ownerId={presentationOwnerId} /> : null}
      <PortalDataBoundary key={ownerId ? `${ownerId}:${role ?? 'none'}` : 'anonymous'} ownerId={ownerId}>
        {children}
      </PortalDataBoundary>
    </>
  );
}
