'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';

const PortalQueryClientContext = createContext<QueryClient | null>(null);

export function PortalQueryClientScope({
  children,
  client,
}: {
  children: ReactNode;
  client: QueryClient;
}) {
  return (
    <PortalQueryClientContext.Provider value={client}>
      {children}
    </PortalQueryClientContext.Provider>
  );
}

export function useOptionalPortalQueryClient(): QueryClient | null {
  return useContext(PortalQueryClientContext);
}
