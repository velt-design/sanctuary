'use client';
import { sendClarityJourneyEvent } from './clarityTracking';

// GTM remains the only loader. Its Google tag is not necessarily in gtag's
// default destination group, so API events must name the verified GA4 stream.
const measurementId = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-KGLF83X6JW').trim();

export function sendGoogleAnalyticsEvent(event: string, properties: Record<string, unknown>, enabled: boolean): boolean {
  if (!enabled || typeof window === 'undefined' || !/^G-[A-Z0-9]+$/.test(measurementId)) return false;
  try {
    sendClarityJourneyEvent(event);
    const target = window as typeof window & { gtag?: (...args: unknown[]) => void };
    if (typeof target.gtag !== 'function') return false;
    target.gtag('event', event, { ...properties, send_to: measurementId });
    return true;
  } catch { return false; }
}
