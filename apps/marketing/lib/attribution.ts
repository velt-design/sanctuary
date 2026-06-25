const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;
const MAX_ATTRIBUTION_VALUE_LENGTH = 600;

type MarketingAttributionPayload = {
  utm: Record<string, string>;
  clickIds: Partial<Record<(typeof CLICK_ID_KEYS)[number], string>>;
  landingPage?: string;
  referrer?: string;
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

export function getBrowserMarketingAttribution(): MarketingAttributionPayload {
  if (typeof window === 'undefined') return { utm: {}, clickIds: {} };
  return getMarketingAttributionFromLocation({
    search: window.location.search,
    href: window.location.href,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  });
}
