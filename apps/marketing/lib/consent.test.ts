import { describe, expect, it } from 'vitest';
import {
  createStoredConsent,
  parseStoredConsent,
  toGtagConsentMode,
} from './consent';

describe('consent helpers', () => {
  it('parses stored consent payloads', () => {
    const stored = createStoredConsent({ analytics: true, marketing: false });
    const parsed = parseStoredConsent(JSON.stringify(stored));
    expect(parsed).not.toBeNull();
    expect(parsed?.analytics).toBe(true);
    expect(parsed?.marketing).toBe(false);
  });

  it('returns null for malformed payloads', () => {
    expect(parseStoredConsent('{')).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ analytics: 'nope' }))).toBeNull();
  });

  it('maps consent choices to gtag consent mode', () => {
    expect(toGtagConsentMode({ analytics: false, marketing: false })).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(toGtagConsentMode({ analytics: true, marketing: true })).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  });
});
