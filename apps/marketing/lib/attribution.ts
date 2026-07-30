const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;
const MAX_ATTRIBUTION_VALUE_LENGTH = 600;
const GA_CLIENT_ID_PATTERN = /^\d{1,20}\.\d{1,20}$/;

type MarketingAttributionConsent = {
  analytics: boolean;
  marketing: boolean;
  capturedAt: string;
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
    if (normalizedKey.startsWith('utm_')) {
      utm[normalizedKey] = cleaned;
      continue;
    }
    if ((CLICK_ID_KEYS as readonly string[]).includes(normalizedKey)) {
      clickIds[normalizedKey as keyof typeof clickIds] = cleaned;
    }
  }

  const landingPage = cleanValue(input.href);
  const referrer = cleanValue(input.referrer);

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

export function getBrowserMarketingAttribution(input?: {
  consent?: { analytics: boolean; marketing: boolean };
  hasStoredChoice?: boolean;
}): MarketingAttributionPayload {
  if (typeof window === 'undefined') return { utm: {}, clickIds: {} };
  const base = getMarketingAttributionFromLocation({
    search: window.location.search,
    href: window.location.href,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  });
  if (!input?.consent) return base;

  const consent: MarketingAttributionConsent = {
    analytics: input.hasStoredChoice === true && input.consent.analytics,
    marketing: input.hasStoredChoice === true && input.consent.marketing,
    capturedAt: new Date().toISOString(),
  };
  const analyticsClientId =
    consent.analytics && typeof document !== 'undefined'
      ? getGaClientIdFromCookie(document.cookie)
      : null;

  return {
    ...base,
    clickIds: consent.marketing ? base.clickIds : {},
    ...(analyticsClientId ? { analyticsClientId } : null),
    consent,
  };
}
