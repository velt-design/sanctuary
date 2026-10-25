'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { publicFramePath, useOwnedPortalPublication, usePortalPageSource } from '@/components/page-state/PortalPageSource';
import type { SearchReadOwner } from './GlobalPortalSearchSurface';

type GlobalPortalSearchStateValue = {
  query: string;
  setQuery: (query: string) => void;
  interactionActive: boolean;
  setInteractionActive: (active: boolean) => void;
  activeInstanceId: string | null;
  setActiveInstanceId: (id: string | null) => void;
  navigationRouteKey: string | null;
  setNavigationRouteKey: (key: string | null) => void;
  guarded: boolean;
  reader: { component: SearchReadOwner } | null;
  publishReader: (value: { component: SearchReadOwner } | null) => void;
};

const GlobalPortalSearchStateContext = createContext<GlobalPortalSearchStateValue | null>(null);

export function GlobalPortalSearchStateProvider({ children }: { children: ReactNode }) {
  const source = usePortalPageSource();
  const guarded = Boolean(source && !source.frameSuppressed && source.selectedPath
    && publicFramePath(source.selectedPath, 'http://localhost'));
  const registration = useOwnedPortalPublication<{ component: SearchReadOwner }>(source?.owner ?? null);
  const [query, setQuery] = useState('');
  const [interactionActive, setInteractionActive] = useState(false);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [navigationRouteKey, setNavigationRouteKey] = useState<string | null>(null);
  const value = useMemo(
    () => ({ query, setQuery, interactionActive, setInteractionActive, activeInstanceId, setActiveInstanceId, navigationRouteKey, setNavigationRouteKey,
      guarded, reader: registration.value, publishReader: registration.publish }),
    [activeInstanceId, interactionActive, navigationRouteKey, query, guarded, registration.value, registration.publish],
  );

  return (
    <GlobalPortalSearchStateContext.Provider value={value}>
      {children}
    </GlobalPortalSearchStateContext.Provider>
  );
}

export function useOptionalGlobalPortalSearchState(): GlobalPortalSearchStateValue | null {
  return useContext(GlobalPortalSearchStateContext);
}
