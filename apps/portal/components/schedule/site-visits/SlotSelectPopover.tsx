'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { SiteVisitCalendarItem } from '@/lib/types/siteVisits';
import styles from '@/app/staff/schedule/schedule.module.css';

const POPOVER_WIDTH = 280;
const POPOVER_MAX_HEIGHT = 320;
const POPOVER_MARGIN = 12;

export default function SlotSelectPopover({
  open,
  anchorRect,
  unscheduled,
  onSelectUnscheduled,
  onCreateNew,
  onClose,
  label,
}: {
  open: boolean;
  anchorRect: DOMRect;
  unscheduled: SiteVisitCalendarItem[];
  onSelectUnscheduled: (item: SiteVisitCalendarItem) => void;
  onCreateNew: () => void;
  onClose: () => void;
  label?: string;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const portalRoot = typeof document === 'undefined' ? null : document.body;

  const style = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const left = Math.min(Math.max(POPOVER_MARGIN, anchorRect.left), viewportW - POPOVER_WIDTH - POPOVER_MARGIN);
    const top = Math.min(anchorRect.bottom + 8, viewportH - POPOVER_MAX_HEIGHT - POPOVER_MARGIN);
    return {
      position: 'fixed' as const,
      top,
      left,
      width: POPOVER_WIDTH,
      maxHeight: POPOVER_MAX_HEIGHT,
      zIndex: 6000,
    };
  }, [anchorRect.bottom, anchorRect.left]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      const node = popoverRef.current;
      if (!node) return;
      if (node.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onClose]);

  if (!open || !portalRoot) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      role="dialog"
      aria-label="Select site visit"
    >
      <div
        style={{
          display: 'grid',
          gap: 8,
          border: '1px solid rgba(15, 15, 16, 0.16)',
          borderRadius: 12,
          background: '#fff',
          padding: 10,
          boxShadow: '0 18px 40px rgba(15, 15, 16, 0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Book slot</div>
            {label ? <div style={{ fontSize: 11, color: 'rgba(15,15,16,0.6)' }}>{label}</div> : null}
          </div>
          <button type="button" className={styles.buttonSecondary} onClick={onClose} style={{ padding: '6px 8px' }}>
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => {
              onCreateNew();
              onClose();
            }}
          >
            Create new site visit…
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(15,15,16,0.6)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Unscheduled
        </div>
        <div style={{ overflow: 'auto', display: 'grid', gap: 6, maxHeight: 180 }}>
          {unscheduled.length ? (
            unscheduled.map((item) => {
              const title = (item.project.name || '').trim() || item.projectId || 'Untitled project';
              const sub = item.project.region || item.project.siteAddress || '';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectUnscheduled(item);
                    onClose();
                  }}
                  style={{
                    textAlign: 'left',
                    border: '1px solid rgba(15, 15, 16, 0.12)',
                    borderRadius: 10,
                    padding: '6px 8px',
                    background: 'rgba(15, 15, 16, 0.02)',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{title}</span>
                  {sub ? <span style={{ fontSize: 11, color: 'rgba(15,15,16,0.6)' }}>{sub}</span> : null}
                </button>
              );
            })
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(15,15,16,0.6)' }}>No unscheduled visits.</div>
          )}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
