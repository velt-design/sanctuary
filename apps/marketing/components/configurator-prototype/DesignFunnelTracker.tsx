'use client';

import { useEffect, useRef } from 'react';
import { useConsent } from '../ConsentProvider';
import type { RailSection } from './RailProvider';

type DesignEvent = 'design_start' | 'design_edit' | 'design_review';
const publicRoutes = new Set(['/', '/contact', '/configurator-preview', '/design-enquiry']);

/** Closed metadata only: the local comparison key must never enter analytics. */
export function emitDesignEvent(event: DesignEvent, allowed: boolean): boolean {
  if (!allowed || typeof window === 'undefined' || !publicRoutes.has(window.location.pathname)
    || new URLSearchParams(window.location.search).has('staff_project')) return false;
  try {
    const target = window as typeof window & { gtag?: (...args: unknown[]) => void };
    if (typeof target.gtag !== 'function') return false;
    target.gtag('event', event, {
      event_category: 'configured_design',
      design_funnel_version: 'v1',
      source_path: window.location.pathname,
      configured_design: true,
    });
    return true;
  } catch { return false; }
}

export default function DesignFunnelTracker({ active, ready, selectionKey, section }: {
  active: boolean; ready: boolean; selectionKey: string; section: RailSection;
}) {
  const { consent, hasTrackingDecision } = useConsent();
  const previous = useRef<{ selectionKey: string; section: RailSection; edited: boolean } | null>(null);
  useEffect(() => {
    if (!active) { previous.current = null; return; }
    if (!ready) return;
    const allowed = hasTrackingDecision && consent.analytics;
    const before = previous.current;
    if (!before) {
      emitDesignEvent('design_start', allowed);
      if (section === 'review') emitDesignEvent('design_review', allowed);
      previous.current = { selectionKey, section, edited: false };
      return;
    }
    // Always advance the baseline, including denied interactions. Never backfill.
    let edited = before.edited;
    if (selectionKey !== before.selectionKey && !edited) {
      emitDesignEvent('design_edit', allowed);
      edited = true;
    }
    if (section === 'review' && before.section !== 'review') emitDesignEvent('design_review', allowed);
    previous.current = { selectionKey, section, edited };
  }, [active, ready, selectionKey, section, hasTrackingDecision, consent.analytics]);
  return null;
}
