'use client';

import { createPortal } from 'react-dom';
import { useMemo } from 'react';
import type { SiteVisitCalendarItem, SiteVisitCalendarPerson } from '@/lib/types/siteVisits';

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
      <div
        style={{
          display: 'grid',
          gap: 6,
          border: '1px solid rgba(15, 15, 16, 0.16)',
          borderRadius: 12,
          background: '#fff',
          padding: 10,
          boxShadow: '0 18px 40px rgba(15, 15, 16, 0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Site visit</div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgba(15,15,16,0.6)',
            }}
          >
            {status}
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {address ? <div style={{ fontSize: 12, color: 'rgba(15,15,16,0.65)' }}>{address}</div> : null}
        {phone ? <div style={{ fontSize: 12, color: 'rgba(15,15,16,0.65)' }}>{phone}</div> : null}

        <div style={{ fontSize: 12, color: 'rgba(15,15,16,0.75)' }}>{when}</div>
        {salespersonName ? <div style={{ fontSize: 11, color: 'rgba(15,15,16,0.6)' }}>Sales: {salespersonName}</div> : null}

        <div style={{ fontSize: 11, color: 'rgba(15,15,16,0.5)' }}>Click to edit</div>
      </div>
    </div>,
    portalRoot,
  );
}
