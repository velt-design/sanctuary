'use client';
import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Keep return visits in place without moving keyboard focus into hidden content. */
export function useJourneyPosition(view: string, scroll: RefObject<HTMLDivElement | null>, heading: RefObject<HTMLHeadingElement | null>) {
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ top: positions.current.get(view) ?? 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [view, scroll, heading]);
  return {
    remember: () => { if (scroll.current) positions.current.set(view, scroll.current.scrollTop); },
    clear: () => positions.current.clear(),
  };
}
