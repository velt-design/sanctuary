'use client';

import { useEffect, useRef } from 'react';
import { useConsent } from '../ConsentProvider';
import type { RailSection } from './RailProvider';
import { channelDesignSource, trackChannelAction } from '../../lib/channelDesignTracking';
import { sendGoogleAnalyticsEvent } from '../../lib/googleAnalyticsEvent';

type DesignEvent = 'design_start' | 'design_edit' | 'design_review' | 'design_enquiry_open' | 'design_share_open' | 'design_share' | 'design_share_link_ready';
const publicRoutes = new Set([
  '/', '/contact', '/contact/thanks', '/configurator-preview', '/design-enquiry',
  '/pergola-guides', '/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland',
  '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland',
  '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs', '/commercial-pergolas-auckland',
  '/architects-designers-builders', '/acrylic-roof-pergolas-auckland', '/simple-pergolas-auckland',
  '/simple-cover-calculator', '/products', '/projects', '/gallery', '/privacy',
]);

function sourcePath(path: string): string | null {
  if (publicRoutes.has(path)) return path;
  // Public detail pages also host the continuation overlay. Send the route
  // template, never an arbitrary URL segment or private quote/invoice ID.
  if (/^\/projects\/[a-z0-9-]+$/.test(path)) return '/projects/[slug]';
  if (/^\/products\/[a-z0-9-]+\/[a-z0-9-]+$/.test(path)) return '/products/[category]/[item]';
  return null;
}

/** Closed metadata only: the local comparison key must never enter analytics. */
export function emitDesignEvent(event: DesignEvent, allowed: boolean): boolean {
  if (typeof window !== 'undefined' && channelDesignSource() !== null
    && ['design_start', 'design_edit', 'design_review', 'design_enquiry_open'].includes(event)) {
    return trackChannelAction(event as 'design_start' | 'design_edit' | 'design_review' | 'design_enquiry_open', allowed, 'full_designer');
  }
  if (!allowed || typeof window === 'undefined'
    || new URLSearchParams(window.location.search).has('staff_project')) return false;
  const path = sourcePath(window.location.pathname);
  if (!path) return false;
  return sendGoogleAnalyticsEvent(event, {
    event_category: 'configured_design',
    design_funnel_version: 'v1',
    source_path: path,
    configured_design: true,
  }, allowed);
}

export default function DesignFunnelTracker({ active, ready, selectionKey, section }: {
  active: boolean; ready: boolean; selectionKey: string; section: RailSection;
}) {
  const { consent, hasTrackingDecision, trackingRegionPolicy } = useConsent();
  const previous = useRef<{ selectionKey: string; section: RailSection; edited: boolean } | null>(null);
  useEffect(() => {
    if (!active || !ready || channelDesignSource() === null) return;
    const review = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('button[data-design-review-action="true"]')) {
        emitDesignEvent('design_review', hasTrackingDecision && consent.analytics);
      }
    };
    const edit = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.closest('dialog[open]') && !target.closest('form')) {
        emitDesignEvent('design_start', hasTrackingDecision && consent.analytics);
        emitDesignEvent('design_edit', hasTrackingDecision && consent.analytics);
      }
    };
    document.addEventListener('click', review, true);
    document.addEventListener('change', edit, true);
    return () => { document.removeEventListener('click', review, true); document.removeEventListener('change', edit, true); };
  }, [active, ready, hasTrackingDecision, consent.analytics]);

  useEffect(() => {
    if (!active) { previous.current = null; return; }
    if (!ready) return;
    const channel = channelDesignSource() !== null;
    // Channel-page interactions consume denied/pending actions immediately.
    // A pending regional lookup is not a denied decision. Start measuring the
    // currently open designer once policy resolves; do not replay earlier edits.
    if (!channel && !hasTrackingDecision && trackingRegionPolicy === null) return;
    const allowed = hasTrackingDecision && consent.analytics;
    const before = previous.current;
    if (!before) {
      if (!channel) {
        emitDesignEvent('design_start', allowed);
        if (section === 'review') emitDesignEvent('design_review', allowed);
      }
      previous.current = { selectionKey, section, edited: false };
      return;
    }
    // Always advance the baseline, including denied interactions. Never backfill.
    let edited = before.edited;
    if (!channel && selectionKey !== before.selectionKey && !edited) {
      emitDesignEvent('design_edit', allowed);
      edited = true;
    }
    if (!channel && section === 'review' && before.section !== 'review') emitDesignEvent('design_review', allowed);
    previous.current = { selectionKey, section, edited };
  }, [active, ready, selectionKey, section, hasTrackingDecision, consent.analytics, trackingRegionPolicy]);
  return null;
}
