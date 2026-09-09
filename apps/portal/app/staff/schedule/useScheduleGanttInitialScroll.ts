'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

// Open around today, with the four previous weeks still available to the left.
// Refreshes and edits must not take the scroll position away from the user.
export function useScheduleGanttInitialScroll(scrollerRef: RefObject<HTMLDivElement | null>, todayLinePx: number, labelWidthPx: number) {
  const initializedElement = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || initializedElement.current === scroller || scroller.clientWidth <= 0) return;
    const viewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.max(0, Math.min(maxLeft, todayLinePx - viewportWidth * 0.3));
    initializedElement.current = scroller;
  });
}
