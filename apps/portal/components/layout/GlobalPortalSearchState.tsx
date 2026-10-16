'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type GlobalPortalSearchStateValue = {
  query: string;
  setQuery: (query: string) => void;
  interactionActive: boolean;
  setInteractionActive: (active: boolean) => void;
  activeInstanceId: string | null;
  setActiveInstanceId: (id: string | null) => void;
  navigationRouteKey: string | null;
  setNavigationRouteKey: (key: string | null) => void;
};

const GlobalPortalSearchStateContext = createContext<GlobalPortalSearchStateValue | null>(null);

export function GlobalPortalSearchStateProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [interactionActive, setInteractionActive] = useState(false);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [navigationRouteKey, setNavigationRouteKey] = useState<string | null>(null);
  const value = useMemo(
    () => ({ query, setQuery, interactionActive, setInteractionActive, activeInstanceId, setActiveInstanceId, navigationRouteKey, setNavigationRouteKey }),
    [activeInstanceId, interactionActive, navigationRouteKey, query],
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
