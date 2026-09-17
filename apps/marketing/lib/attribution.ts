import type {
  TrackingBasis,
  TrackingRegionPolicy,
} from './trackingRegion';

import { CAMPAIGN_CLICK_KEYS as CLICK_ID_KEYS, CAMPAIGN_UTM_KEYS, clearCampaignSession, readCampaignSession } from './campaignSession';
import { CONSENT_STORAGE_KEY, parseStoredConsent } from './consent';
const MAX_ATTRIBUTION_VALUE_LENGTH = 600;
const GA_CLIENT_ID_PATTERN = /^\d{1,20}\.\d{1,20}$/;

type MarketingAttributionConsent = {
  analytics: boolean;
  marketing: boolean;
  capturedAt: string;
  basis: TrackingBasis;
  regionPolicy?: TrackingRegionPolicy;
};

type MarketingAttributionPayload = {
  utm: Record<string, string>;
  clickIds: Partial<Record<(typeof CLICK_ID_KEYS)[number], string>>;
  landingPage?: string;
  referrer?: string;
  analyticsClientId?: string;
  consent?: MarketingAttributionConsent;
};

function cleanValue(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_ATTRIBUTION_VALUE_LENGTH);
}

function cleanAttributionUrl(value: string | null | undefined): string | null {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.search = ''; url.hash = '';
    return url.toString();
  } catch { return null; }
}

export function getMarketingAttributionFromLocation(input: {
  search: string;
  href?: string | null;
  referrer?: string | null;
}): MarketingAttributionPayload {
  const params = new URLSearchParams(input.search);
  const utm: Record<string, string> = {};
  const clickIds: MarketingAttributionPayload['clickIds'] = {};

  for (const [key, value] of params.entries()) {
    const normalizedKey = key.trim().toLowerCase();
    const cleaned = cleanValue(value);
    if (!cleaned) continue;
    if ((CAMPAIGN_UTM_KEYS as readonly string[]).includes(normalizedKey)) {
      utm[normalizedKey] = cleaned;
      continue;
    }
    if ((CLICK_ID_KEYS as readonly string[]).includes(normalizedKey)) {
      clickIds[normalizedKey as keyof typeof clickIds] = cleaned;
    }
  }

  const landingPage = cleanAttributionUrl(input.href);
  const referrer = cleanAttributionUrl(input.referrer);

  return {
    utm,
    clickIds,
    ...(landingPage ? { landingPage } : null),
    ...(referrer ? { referrer } : null),
  };
}

export function getGaClientIdFromCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== '_ga') continue;
    const rawValue = part.slice(separator + 1).trim();
    let value = rawValue;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      return null;
    }
    const segments = value.split('.');
    if (segments.length < 4) return null;
    const clientId = segments.slice(-2).join('.');
    return GA_CLIENT_ID_PATTERN.test(clientId) ? clientId : null;
  }
  return null;
}

export function getBrowserMarketingAttribution(input: {
  consent: { analytics: boolean; marketing: boolean };
  trackingBasis: TrackingBasis;
  trackingRegionPolicy: TrackingRegionPolicy | null;
}): MarketingAttributionPayload {
  if (typeof window === 'undefined') return { utm: {}, clickIds: {} };
  let base = getMarketingAttributionFromLocation({
    search: window.location.search,
    href: window.location.href,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  });

  const hasTrackingDecision = input.trackingBasis !== 'none';
  const consent: MarketingAttributionConsent = {
    analytics: hasTrackingDecision && input.consent.analytics,
    marketing: hasTrackingDecision && input.consent.marketing,
    capturedAt: new Date().toISOString(),
    basis: input.trackingBasis,
    ...(input.trackingRegionPolicy
      ? { regionPolicy: input.trackingRegionPolicy }
      : null),
  };
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* Optional storage. */ }
  // A withdrawal in another tab wins even before React processes its event.
  try { if (parseStoredConsent(window.localStorage?.getItem(CONSENT_STORAGE_KEY) ?? null)?.marketing === false) consent.marketing = false; } catch { /* Preserve the current in-memory decision. */ }
  if (consent.marketing) base = readCampaignSession(storage) ?? base;
  else if (hasTrackingDecision) clearCampaignSession(storage);
  const analyticsClientId =
    consent.analytics && typeof document !== 'undefined'
      ? getGaClientIdFromCookie(document.cookie)
      : null;

  return {
    utm: consent.marketing ? base.utm : {},
    clickIds: consent.marketing ? base.clickIds : {},
    ...(consent.marketing && base.landingPage ? { landingPage: base.landingPage } : null),
    ...(consent.marketing && base.referrer ? { referrer: base.referrer } : null),
    ...(analyticsClientId ? { analyticsClientId } : null),
    consent,
  };
}
