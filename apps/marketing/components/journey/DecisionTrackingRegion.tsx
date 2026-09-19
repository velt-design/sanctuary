'use client';

import type { ReactNode } from 'react';
import { useConsent } from '../ConsentProvider';
import { sendGoogleAnalyticsEvent } from '../../lib/googleAnalyticsEvent';

type DecisionSource = 'cost_guide' | 'product_hub' | 'product_detail' | 'guide_navigation' | 'product_comparison';
const actions = new Set(['design', 'help', 'compare']);
const destinations = new Set(['designer', 'enquiry', 'product', 'planning_content']);

/** Only authored closed codes leave this region; URLs and visible text are never read. */
export default function DecisionTrackingRegion({ source, children }: { source: DecisionSource; children: ReactNode }) {
  const { consent, hasTrackingDecision } = useConsent();
  return <div style={{ display: 'contents' }} onClickCapture={event => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[data-journey-action]');
    if (!link || !event.currentTarget.contains(link)) return;
    const action = link.dataset.journeyAction;
    const destination = link.dataset.journeyDestination;
    if (!action || !destination || !actions.has(action) || !destinations.has(destination)) return;
    sendGoogleAnalyticsEvent('journey_decision_click', {
      event_category: 'journey', journey_version: 'v1', decision_source: source,
      decision_action: action, destination_category: destination,
    }, hasTrackingDecision && consent.analytics);
  }}>{children}</div>;
}
