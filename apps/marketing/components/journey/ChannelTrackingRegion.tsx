'use client';
import type { ReactNode } from 'react';
import { useConsent } from '../ConsentProvider';
import { trackChannelAction } from '../../lib/channelDesignTracking';

/** Authored CTA codes only. Do not inspect labels, URLs or form values. */
export default function ChannelTrackingRegion({ children }: { children: ReactNode }) {
  const { consent, hasTrackingDecision } = useConsent();
  return <div style={{ display: 'contents' }} onClickCapture={event => {
    const target = event.target instanceof Element ? event.target.closest('[data-channel-action]') : null;
    const action = target?.getAttribute('data-channel-action');
    if (action === 'quote' || action === 'design_enquiry_open' || action === 'design_start') trackChannelAction(action, hasTrackingDecision && consent.analytics);
  }}>{children}</div>;
}
