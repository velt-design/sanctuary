'use client';

import type { PortalWebVitalEvent } from './webVitals';

const PORTAL_WEB_VITALS_URL = '/api/staff/v1/performance/web-vitals';

export function sendPortalWebVital(event: PortalWebVitalEvent): void {
  const body = JSON.stringify(event);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(PORTAL_WEB_VITALS_URL, blob)) return;
  }
  if (typeof fetch !== 'function') return;
  void fetch(PORTAL_WEB_VITALS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}
