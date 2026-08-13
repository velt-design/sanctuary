'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type GlobalPortalSearchStateValue = {
  query: string;
  setQuery: (query: string) => void;
  interactionActive: boolean;
  setInteractionActive: (active: boolean) => void;
};

const GlobalPortalSearchStateContext = createContext<GlobalPortalSearchStateValue | null>(null);

export function GlobalPortalSearchStateProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [interactionActive, setInteractionActive] = useState(false);
  const value = useMemo(
    () => ({ query, setQuery, interactionActive, setInteractionActive }),
    [interactionActive, query],
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
