export const CONSENT_STORAGE_KEY = 'sp_consent_v1';
export const CONSENT_UPDATED_EVENT = 'sp-consent-updated';
const CONSENT_SCHEMA_VERSION = 1 as const;

export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
  version: typeof CONSENT_SCHEMA_VERSION;
};

export type ConsentUpdate = Pick<ConsentPreferences, 'analytics' | 'marketing'>;

type GtagConsentValue = 'granted' | 'denied';

type GtagConsentModeParams = {
  analytics_storage: GtagConsentValue;
  ad_storage: GtagConsentValue;
  ad_user_data: GtagConsentValue;
  ad_personalization: GtagConsentValue;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
}

export function createDefaultConsent(): ConsentPreferences {
  return {
    analytics: false,
    marketing: false,
    updatedAt: new Date(0).toISOString(),
    version: CONSENT_SCHEMA_VERSION,
  };
}

export function createRegionalDefaultConsent(): ConsentPreferences {
  return {
    analytics: true,
    marketing: true,
    updatedAt: new Date().toISOString(),
    version: CONSENT_SCHEMA_VERSION,
  };
}

export function createStoredConsent(update: ConsentUpdate): ConsentPreferences {
  return {
    analytics: Boolean(update.analytics),
    marketing: Boolean(update.marketing),
    updatedAt: new Date().toISOString(),
    version: CONSENT_SCHEMA_VERSION,
  };
}

function normalizeConsent(value: unknown): ConsentPreferences | null {
  if (!isRecord(value)) return null;

  const analytics = normalizeBoolean(value.analytics);
  const marketing = normalizeBoolean(value.marketing);
  if (analytics == null || marketing == null) return null;

  const updatedAtRaw = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  const updatedAt = updatedAtRaw && !Number.isNaN(Date.parse(updatedAtRaw)) ? updatedAtRaw : new Date().toISOString();

  return {
    analytics,
    marketing,
    updatedAt,
    version: CONSENT_SCHEMA_VERSION,
  };
}

export function parseStoredConsent(raw: string | null): ConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeConsent(parsed);
  } catch {
    return null;
  }
}

export function serializeConsent(consent: ConsentPreferences): string {
  return JSON.stringify(consent);
}

export function toGtagConsentMode(consent: ConsentUpdate): GtagConsentModeParams {
  const analytics = consent.analytics ? 'granted' : 'denied';
  const marketing = consent.marketing ? 'granted' : 'denied';
  return {
    analytics_storage: analytics,
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
  };
}
