'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from './ConsentProvider';
import { callClarity, clarityPageAllowed, clarityProjectId, type ClarityWindow } from '../lib/clarityTracking';

const project = clarityProjectId(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID);

export default function ClarityAnalytics() {
  const { consent, hasTrackingDecision } = useConsent();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const installed = useRef(false);
  const active = useRef(false);

  useLayoutEffect(() => {
    const target = window as ClarityWindow;
    const allowed = Boolean(project && hasTrackingDecision && consent.analytics && clarityPageAllowed(pathname, search));
    if (!allowed) {
      target.sanctuaryClarityActive = false;
      if (active.current) {
        callClarity(target, 'consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
        callClarity(target, 'stop');
        active.current = false;
      }
      return;
    }
    if (!target.clarity) {
      target.clarity = (...args: unknown[]) => { (target.clarity!.q ??= []).push(args); };
    }
    if (!callClarity(target, 'consentv2', { analytics_Storage: 'granted', ad_Storage: consent.marketing ? 'granted' : 'denied' })) {
      callClarity(target, 'stop');
      active.current = false;
      target.sanctuaryClarityActive = false;
      return;
    }
    callClarity(target, 'set', 'environment', location.hostname === 'www.sanctuarypergolas.co.nz' || location.hostname === 'sanctuarypergolas.co.nz' ? 'production' : 'verification');
    if (!installed.current) {
      const script = document.createElement('script');
      script.id = 'sp-clarity';
      script.async = true;
      script.src = `https://www.clarity.ms/tag/${project}`;
      document.head.appendChild(script);
      installed.current = true;
    } else if (!active.current) {
      if (!callClarity(target, 'start')) return;
    }
    active.current = true;
    target.sanctuaryClarityActive = true;
  }, [pathname, search, consent.analytics, consent.marketing, hasTrackingDecision]);

  useLayoutEffect(() => () => {
    const target = window as ClarityWindow;
    if (active.current) callClarity(target, 'stop');
    target.sanctuaryClarityActive = false;
    active.current = false;
  }, []);
  return null;
}
