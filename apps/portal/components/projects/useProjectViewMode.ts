'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type ProjectViewMode = 'general' | 'focus';

function normalize(value: string | null): ProjectViewMode {
  return value === 'focus' ? 'focus' : 'general';
}

export function useProjectViewMode(initialMode?: ProjectViewMode) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const modeFromUrl = useMemo(() => normalize(searchParams.get('mode')), [searchParams]);
  const [mode, setModeState] = useState<ProjectViewMode>(() => initialMode ?? 'general');

  useEffect(() => {
    setModeState(modeFromUrl);
  }, [modeFromUrl]);

  const setMode = useCallback(
    (next: ProjectViewMode) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next === 'general') qs.delete('mode');
      else qs.set('mode', 'focus');
      const query = qs.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`);
    },
    [pathname, router, searchParams],
  );

  return { mode, setMode };
}
