'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Presentation only: never retain message text, sources or an authorization result.
// The parent keys this mounted state to the project and customer identity.
function useReadingState() {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const set = useCallback((key: string, value: boolean) => setOpen(previous => {
    if (previous.has(key) === value) return previous;
    const next = new Set(previous);
    if (value) next.add(key); else next.delete(key);
    if (next.size > 128) next.delete(next.values().next().value!);
    return next;
  }), []);
  const clear = useCallback(() => setOpen(previous => previous.size ? new Set() : previous), []);
  return useMemo(() => ({ open, set, clear }), [open, set, clear]);
}

const ReadingContext = createContext<ReturnType<typeof useReadingState> | null>(null);

export function ProjectEmailReadingProvider({ children }: { children: ReactNode }) {
  return <ReadingContext.Provider value={useReadingState()}>{children}</ReadingContext.Provider>;
}

export function useProjectEmailReadingState() {
  const shared = useContext(ReadingContext);
  const local = useReadingState();
  return shared ?? local;
}
