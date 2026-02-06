'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export type ProjectViewMode = 'general' | 'focus';

function normalize(value: string | null): ProjectViewMode {
  return value === 'focus' ? 'focus' : 'general';
}

export function useProjectViewMode(initialMode?: ProjectViewMode) {
  const searchParams = useSearchParams();

  const modeFromUrl = useMemo(() => normalize(searchParams.get('mode')), [searchParams]);
  const [mode, setModeState] = useState<ProjectViewMode>(() => initialMode ?? 'general');

  useEffect(() => {
    setModeState(modeFromUrl);
  }, [modeFromUrl]);

  const setMode = useCallback(
    (next: ProjectViewMode) => {
      setModeState(next);
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      const qs = new URLSearchParams(searchParams.toString());
      if (next === 'general') qs.delete('mode');
      else qs.set('mode', 'focus');
      url.search = qs.toString();
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      // replaceState avoids stacking history entries when toggling quickly
      window.history.replaceState({}, '', nextUrl);
    },
    [searchParams],
  );

  return { mode, setMode };
}
