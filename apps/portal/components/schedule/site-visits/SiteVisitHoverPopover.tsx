'use client';

import { createPortal } from 'react-dom';
import { useMemo } from 'react';
import type { SiteVisitCalendarItem, SiteVisitCalendarPerson } from '@/lib/types/siteVisits';
import styles from '@/app/staff/schedule/schedule.module.css';

export default function SiteVisitHoverPopover({
  open,
  anchorRect,
  item,
  salesPeople,
}: {
  open: boolean;
  anchorRect: DOMRect;
  item: SiteVisitCalendarItem;
  salesPeople: readonly SiteVisitCalendarPerson[];
}) {
  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  const salespersonName = useMemo(() => {
    const id = (item.salespersonId || '').trim();
    if (!id) return '';
    return salesPeople.find((p) => p.id === id)?.name ?? id;
  }, [item.salespersonId, salesPeople]);

  const style = useMemo(() => {
    const width = 300;
    const height = 170;
    const pad = 10;

    let left = anchorRect.right + 10;
    let top = anchorRect.top;

    if (typeof window !== 'undefined') {
      if (left + width > window.innerWidth - pad) left = Math.max(pad, anchorRect.left - width - 10);
      if (top + height > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - height - pad);
      if (top < pad) top = pad;
    }

    return {
      position: 'fixed' as const,
      left,
      top,
      width,
      zIndex: 7000,
      pointerEvents: 'none' as const,
    };
  }, [anchorRect]);

  if (!open || !portalRoot) return null;

  const status = String(item.status || '').toUpperCase();
  const title = item.contact?.name || item.project?.name || item.projectId || 'Untitled';
  const address = item.project?.siteAddress || item.project?.region || '';
  const phone = item.contact?.phone || '';
  const start = item.scheduledStart ? new Date(item.scheduledStart) : null;
  const end = item.scheduledEnd ? new Date(item.scheduledEnd) : null;

  const when = start
    ? `${start.toLocaleString('en-NZ', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}${
        end ? ` \u2192 ${end.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}` : ''
      }`
    : '\u2014';

  return createPortal(
    <div style={style} role="tooltip" aria-label="Site visit info">
      <div className={styles.siteVisitTooltip}>
        <div className={styles.siteVisitTooltipHeader}>
          <div className={styles.siteVisitTooltipEyebrow}>Site visit</div>
          <div className={styles.siteVisitTooltipStatus}>
            {status}
          </div>
        </div>

        <div className={styles.siteVisitTooltipTitle}>{title}</div>
        {address ? <div className={styles.siteVisitTooltipText}>{address}</div> : null}
        {phone ? <div className={styles.siteVisitTooltipText}>{phone}</div> : null}

        <div className={styles.siteVisitTooltipWhen}>{when}</div>
        {salespersonName ? <div className={styles.siteVisitTooltipMeta}>Sales: {salespersonName}</div> : null}

        <div className={styles.siteVisitTooltipHint}>Click to edit</div>
      </div>
    </div>,
    portalRoot,
  );
}
