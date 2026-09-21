'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Presentation only: never retain message text, sources or an authorization result.
// Reset this state on identity changes without remounting unrelated tab editors.
function useReadingState(scope = '') {
  const [stored, setStored] = useState<{ scope: string; open: ReadonlySet<string> }>(() => ({ scope, open: new Set() }));
  if (stored.scope !== scope) setStored({ scope, open: new Set() });
  const open = stored.open;
  const set = useCallback((key: string, value: boolean) => setStored(previous => {
    if (previous.scope !== scope || previous.open.has(key) === value) return previous;
    const next = new Set(previous.open);
    if (value) next.add(key); else next.delete(key);
    if (next.size > 128) next.delete(next.values().next().value!);
    return { scope, open: next };
  }), [scope]);
  const clear = useCallback(() => setStored(previous => previous.scope === scope && previous.open.size ? { scope, open: new Set() } : previous), [scope]);
  return useMemo(() => ({ scope, open, set, clear }), [scope, open, set, clear]);
}

const ReadingContext = createContext<ReturnType<typeof useReadingState> | null>(null);

export function ProjectEmailReadingProvider({ children, scope = '' }: { children: ReactNode; scope?: string }) {
  return <ReadingContext.Provider value={useReadingState(scope)}>{children}</ReadingContext.Provider>;
}

export function useProjectEmailReadingState() {
  const shared = useContext(ReadingContext);
  const local = useReadingState();
  return shared ?? local;
}
