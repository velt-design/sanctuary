"use client";

import { useCallback, useEffect, useState } from 'react';

export type ProjectViewMode = 'general' | 'focus';

function normalize(value: string | null): ProjectViewMode {
  return value === 'focus' ? 'focus' : 'general';
}

export function useProjectViewMode(initialMode?: ProjectViewMode) {
  const [mode, setModeState] = useState<ProjectViewMode>(() => {
    if (typeof window === 'undefined') return initialMode ?? 'general';
    const url = new URL(window.location.href);
    return normalize(url.searchParams.get('mode'));
  });

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      setModeState(normalize(url.searchParams.get('mode')));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setMode = useCallback((next: ProjectViewMode) => {
    setModeState(next);
    const url = new URL(window.location.href);
    if (next === 'general') url.searchParams.delete('mode');
    else url.searchParams.set('mode', 'focus');
    window.history.pushState({}, '', url.toString());
  }, []);

  return { mode, setMode };
}
