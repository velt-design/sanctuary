'use client';

import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react';

// Only viewport geometry is retained, never report records or attribution data.
export default function useReportReturnPosition(busy: boolean) {
  const region = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const [height, setHeight] = useState<number>();
  const key = () => `marketing-report-position:${window.location.pathname}${window.location.search}`;
  useLayoutEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key()) ?? 'null');
      if (saved && Number.isFinite(saved.height) && Number.isFinite(saved.y)) {
        setHeight(saved.height);
        pending.current = saved.y;
      }
    } catch { /* Storage is optional; reporting still works when unavailable. */ }
  }, []);
  useLayoutEffect(() => {
    if (height === undefined || pending.current === null) return;
    const y = pending.current;
    if (!busy) pending.current = null;
    window.scrollTo({ top: y, behavior: 'instant' });
  }, [busy, height]);
  const remember = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.closest('a[href]') || busy) return;
    try {
      sessionStorage.setItem(key(), JSON.stringify({ height: region.current?.getBoundingClientRect().height ?? 780, y: window.scrollY }));
    } catch { /* Browser Back still works without storage. */ }
  };
  // Capture current footprint before a refresh/date change replaces the rows.
  useLayoutEffect(() => {
    if (!busy && region.current) setHeight(region.current.getBoundingClientRect().height);
  }, [busy]);
  return { region, height, remember };
}
