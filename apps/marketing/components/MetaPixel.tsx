"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { trackingAudienceAllowed } from '../lib/trackingAudience';
import { useConsent } from '@/components/ConsentProvider';
import { flushPendingMetaLeads, setMetaLeadPermission } from '../lib/metaLead';
import { CONSENT_UPDATED_EVENT } from '../lib/consent';

export default function MetaPixel() {
  const { consent, hasTrackingDecision } = useConsent();
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    setMetaLeadPermission(trackingAudienceAllowed() && hasTrackingDecision && consent.marketing);
    const permissionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ consent?: { marketing?: boolean }; trackingBasis?: string }>).detail;
      setMetaLeadPermission(trackingAudienceAllowed() && detail?.consent?.marketing === true &&
        (detail.trackingBasis === 'user_choice' || detail.trackingBasis === 'regional_default'));
    };
    window.addEventListener(CONSENT_UPDATED_EVENT, permissionChanged);
    const disposePermission = () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, permissionChanged);
      setMetaLeadPermission(false);
    };
    if (!consent.marketing || !trackingAudienceAllowed()) {
      setShouldLoad(false);
      return disposePermission;
    }

    let timerId: number | null = null;

    const schedule = () => {
      timerId = window.setTimeout(() => setShouldLoad(true), 2800);
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      window.removeEventListener('load', schedule);
      if (timerId !== null) window.clearTimeout(timerId);
      disposePermission();
    };
  }, [consent.marketing, hasTrackingDecision]);

  if (!consent.marketing || !shouldLoad || !trackingAudienceAllowed()) return null;

  return <Script id="sp-runtime-meta" src="/runtime-meta.js" strategy="afterInteractive"
    onReady={() => flushPendingMetaLeads(consent.marketing)} />;
}
