'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ScheduleView } from './ScheduleViewTabs';

type LegacyScheduleView = Extract<ScheduleView, 'board' | 'gantt'>;

function initialLegacyScheduleView(
  initialView: LegacyScheduleView | undefined,
  routeView: string | null,
): ScheduleView {
  if (initialView) return initialView;
  const normalized = (routeView ?? '').trim().toLowerCase();
  if (normalized === 'site-visits') return 'site_visits';
  if (normalized === 'gantt') return 'gantt';
  return 'board';
}

export function useLegacyScheduleView(
  initialView: LegacyScheduleView | undefined,
  routeView: string | null,
) {
  const [view, setView] = useState<ScheduleView>(() => initialLegacyScheduleView(initialView, routeView));
  const pendingViewRef = useRef<{ from: LegacyScheduleView; target: LegacyScheduleView } | null>(null);

  useEffect(() => {
    if (!initialView) return;
    const pending = pendingViewRef.current;
    if (pending) {
      if (initialView === pending.target) pendingViewRef.current = null;
      else if (initialView === pending.from) return;
      else pendingViewRef.current = null;
    }
    setView(initialView);
  }, [initialView]);

  const selectView = useCallback((next: ScheduleView) => {
    if (next === 'site_visits') return;
    pendingViewRef.current = {
      from: view === 'gantt' ? 'gantt' : 'board',
      target: next,
    };
    setView(next);
  }, [view]);

  return { view, selectView };
}
