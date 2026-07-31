'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const GANTT_COMPACT_MAX_WIDTH_PX = 640;
const GANTT_COMPACT_MAX_HEIGHT_PX = 360;

export type ScheduleGanttLayoutMode = 'timeline' | 'compact' | 'compact-short';

export function useScheduleGanttLayoutMode() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ScheduleGanttLayoutMode>('timeline');

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      const width = Math.max(0, Math.floor(root.clientWidth));
      const height = Math.max(0, Math.floor(root.clientHeight));
      if (width === 0) return;
      const next: ScheduleGanttLayoutMode = width <= GANTT_COMPACT_MAX_WIDTH_PX
        ? 'compact'
        : height > 0 && height <= GANTT_COMPACT_MAX_HEIGHT_PX
          ? 'compact-short'
          : 'timeline';
      setMode((current) => (current === next ? current : next));
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(root);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return { rootRef, mode };
}
