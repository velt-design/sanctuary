'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from './ConsentProvider';
import { getMarketingAttributionFromLocation } from '../lib/attribution';
import { CAMPAIGN_SESSION_MS, captureCampaignSession, clearCampaignSession, hasCampaign, readCampaignSession, type CampaignContext } from '../lib/campaignSession';

export default function CampaignAttribution() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { consent, hasTrackingDecision } = useConsent();
  const previousRoute = useRef<string | null>(null);
  const candidate = useRef<{ context: CampaignContext; observedAt: number; newArrival: boolean } | null>(null);
  useEffect(() => {
    const route = `${pathname}?${search}`;
    if (previousRoute.current !== route) {
      const context = getMarketingAttributionFromLocation({ search, href: window.location.href, referrer: document.referrer });
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (hasCampaign(context)) candidate.current = { context, observedAt: Date.now(), newArrival: previousRoute.current !== null || navigation?.type !== 'reload' };
      previousRoute.current = route;
    }
    // Before a decision, only sanitized page context lives in this mounted
    // component's memory. Hard navigation can lose it; no tracking is replayed.
    if (!hasTrackingDecision) return;
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* Optional storage. */ }
    if (!consent.marketing) { clearCampaignSession(storage); candidate.current = null; return; }
    readCampaignSession(storage);
    const pending = candidate.current;
    if (pending && Date.now() - pending.observedAt < CAMPAIGN_SESSION_MS) captureCampaignSession(pending.context, storage, pending.newArrival);
    candidate.current = null;
  }, [pathname, search, consent.marketing, hasTrackingDecision]);
  return null;
}
