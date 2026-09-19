'use client';

import { useRef } from 'react';
import { sendGoogleAnalyticsEvent } from '../../lib/googleAnalyticsEvent';

/** Observe a first edit, including denied edits, without reading any field value. */
export function useEnquiryInteraction(surface: 'contact' | 'embedded', configured: boolean, allowed: boolean) {
  const observed = useRef(false);
  return () => {
    if (observed.current) return;
    observed.current = true;
    sendGoogleAnalyticsEvent('contact_form_interaction', {
      event_category: 'contact', form_surface: surface,
      configured_design: configured, contact_funnel_version: 'v1',
    }, allowed);
  };
}
