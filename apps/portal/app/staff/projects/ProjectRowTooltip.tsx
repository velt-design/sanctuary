'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { projectTooltipSummaryQueryOptions } from '@/lib/queries/projects';
import styles from './ProjectRowTooltip.module.css';

export type ProjectRowTooltipVisibleInfo = { projectId: string; x: number; y: number };

const SHOW_DELAY_MS = 280;
const HIDE_DELAY_MS = 140;
const TOOLTIP_OFFSET = 14;
const TOOLTIP_VIEWPORT_PADDING = 8;

const NZD_FORMATTER = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
});

function formatTotalCents(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents <= 0) return '—';
  return NZD_FORMATTER.format(cents / 100);
}

export function useProjectRowTooltip() {
  const [visibleInfo, setVisibleInfo] = useState<ProjectRowTooltipVisibleInfo | null>(null);
  const isWarmRef = useRef(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const onRowEnter = useCallback((projectId: string, event: MouseEvent<HTMLElement>) => {
    const info = { projectId, x: event.clientX, y: event.clientY };
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (isWarmRef.current) {
      setVisibleInfo(info);
      return;
    }
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      isWarmRef.current = true;
      setVisibleInfo(info);
    }, SHOW_DELAY_MS);
  }, []);

  const onRowLeave = useCallback(() => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      isWarmRef.current = false;
      setVisibleInfo(null);
    }, HIDE_DELAY_MS);
  }, []);

  return { visibleInfo, onRowEnter, onRowLeave };
}

function ProjectRowTooltipBody({
  host,
  projectId,
  fallbackClientName,
}: {
  host: string;
  projectId: string;
  fallbackClientName: string;
}) {
  const { data, isLoading, isError } = useQuery({
    ...projectTooltipSummaryQueryOptions(host, projectId),
  });

  if (isLoading) {
    return <div className={styles.tooltipBody}>Loading…</div>;
  }
  if (isError) {
    return <div className={styles.tooltipBody}>Couldn’t load summary.</div>;
  }

  const clientLine = data?.clientName?.trim() || fallbackClientName.trim() || '—';
  const styleLine = data?.roofStyleLabel ?? '—';
  const materialLine = data?.materialLabel ?? '—';
  const totalLine = formatTotalCents(data?.totalCents ?? null);

  return (
    <div className={styles.tooltipBody}>
      <div className={styles.tooltipClient}>{clientLine}</div>
      <div className={styles.tooltipLine}>{styleLine}</div>
      <div className={styles.tooltipLine}>{materialLine}</div>
      <div className={styles.tooltipPrice}>{totalLine}</div>
    </div>
  );
}

export function ProjectRowTooltip({
  host,
  visibleInfo,
  fallbackClientName,
}: {
  host: string;
  visibleInfo: ProjectRowTooltipVisibleInfo | null;
  fallbackClientName: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number }>({
    x: visibleInfo?.x ?? -9999,
    y: visibleInfo?.y ?? -9999,
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const el = ref.current;
    if (!el) return;
    let pending = false;
    const place = (x: number, y: number) => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x + TOOLTIP_OFFSET;
      let top = y + TOOLTIP_OFFSET;
      if (left + rect.width > vw - TOOLTIP_VIEWPORT_PADDING) {
        left = Math.max(TOOLTIP_VIEWPORT_PADDING, x - TOOLTIP_OFFSET - rect.width);
      }
      if (top + rect.height > vh - TOOLTIP_VIEWPORT_PADDING) {
        top = Math.max(TOOLTIP_VIEWPORT_PADDING, y - TOOLTIP_OFFSET - rect.height);
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };
    const onMove = (event: globalThis.MouseEvent) => {
      lastPositionRef.current = { x: event.clientX, y: event.clientY };
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        place(lastPositionRef.current.x, lastPositionRef.current.y);
      });
    };
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
    };
  }, [isMounted]);

  useLayoutEffect(() => {
    if (!visibleInfo) return;
    lastPositionRef.current = { x: visibleInfo.x, y: visibleInfo.y };
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = visibleInfo.x + TOOLTIP_OFFSET;
    let top = visibleInfo.y + TOOLTIP_OFFSET;
    if (left + rect.width > vw - TOOLTIP_VIEWPORT_PADDING) {
      left = Math.max(TOOLTIP_VIEWPORT_PADDING, visibleInfo.x - TOOLTIP_OFFSET - rect.width);
    }
    if (top + rect.height > vh - TOOLTIP_VIEWPORT_PADDING) {
      top = Math.max(TOOLTIP_VIEWPORT_PADDING, visibleInfo.y - TOOLTIP_OFFSET - rect.height);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [visibleInfo]);

  if (!isMounted || typeof document === 'undefined') return null;

  const isVisible = Boolean(visibleInfo);
  const className = isVisible
    ? `${styles.floatingTooltip} ${styles.floatingTooltipVisible}`
    : styles.floatingTooltip;

  return createPortal(
    <div ref={ref} className={className} role="tooltip" aria-hidden={!isVisible}>
      {visibleInfo ? (
        <ProjectRowTooltipBody host={host} projectId={visibleInfo.projectId} fallbackClientName={fallbackClientName} />
      ) : null}
    </div>,
    document.body,
  );
}
