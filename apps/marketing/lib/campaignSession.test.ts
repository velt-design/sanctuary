import { beforeEach, describe, expect, it } from 'vitest';
import { CAMPAIGN_SESSION_KEY, CAMPAIGN_SESSION_MS, captureCampaignSession, clearCampaignSession, readCampaignSession } from './campaignSession';
import { getMarketingAttributionFromLocation } from './attribution';

describe('bounded campaign session', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const campaign = getMarketingAttributionFromLocation({ search: '?utm_source=meta&utm_campaign=synthetic&secret=private&utm_unknown=no&fbclid=no', href: 'https://example.test/design?secret=private#private' });
  beforeEach(() => values.clear());
  it('retains only governed campaign fields and sanitized landing URL through untagged navigation', () => {
    captureCampaignSession(campaign, storage, true, 100);
    expect(readCampaignSession(storage, 200)).toEqual({ utm: { utm_source: 'meta', utm_campaign: 'synthetic' }, clickIds: {}, landingPage: 'https://example.test/design' });
    expect(storage.getItem(CAMPAIGN_SESSION_KEY)).not.toMatch(/secret|private|unknown|fbclid/);
  });
  it('expires absolutely and erases values, and refresh cannot renew expired context', () => {
    captureCampaignSession(campaign, storage, true, 100);
    captureCampaignSession({ ...campaign, referrer: 'https://example.test/other' }, storage, false, 200);
    expect(JSON.parse(storage.getItem(CAMPAIGN_SESSION_KEY)!).capturedAt).toBe(100);
    expect(readCampaignSession(storage, 100 + CAMPAIGN_SESSION_MS)).toEqual({ utm: {}, clickIds: {} });
    expect(storage.getItem(CAMPAIGN_SESSION_KEY)).not.toContain('synthetic');
    captureCampaignSession(campaign, storage, false, 200 + CAMPAIGN_SESSION_MS);
    expect(readCampaignSession(storage, 200 + CAMPAIGN_SESSION_MS)).toEqual({ utm: {}, clickIds: {} });
    captureCampaignSession(campaign, storage, true, 300 + CAMPAIGN_SESSION_MS);
    expect(readCampaignSession(storage, 300 + CAMPAIGN_SESSION_MS)?.utm.utm_source).toBe('meta');
  });
  it('latest different tagged arrival replaces the first; identical reordered tags do not slide expiry', () => {
    captureCampaignSession(campaign, storage, true, 100);
    captureCampaignSession({ ...campaign, utm: { utm_campaign: 'synthetic', utm_source: 'meta' } }, storage, true, 200);
    expect(JSON.parse(storage.getItem(CAMPAIGN_SESSION_KEY)!).capturedAt).toBe(100);
    captureCampaignSession({ ...campaign, utm: { utm_source: 'newsletter' } }, storage, true, 300);
    expect(readCampaignSession(storage, 400)?.utm).toEqual({ utm_source: 'newsletter' });
    clearCampaignSession(storage);
    expect(readCampaignSession(storage, 500)).toBeUndefined();
  });
  it('rejects unsafe or unexpected stored values and handles blocked storage', () => {
    storage.setItem(CAMPAIGN_SESSION_KEY, JSON.stringify({ version: 1, capturedAt: 100, context: { ...campaign, landingPage: 'https://example.test/?secret=private' } }));
    expect(readCampaignSession(storage, 200)).toEqual({ utm: {}, clickIds: {} });
    storage.setItem(CAMPAIGN_SESSION_KEY, 'malformed');
    expect(readCampaignSession(storage, 200)).toBeUndefined();
    expect(storage.getItem(CAMPAIGN_SESSION_KEY)).toBeNull();
    expect(() => captureCampaignSession(campaign, { ...storage, setItem: () => { throw new Error('blocked'); } }, true)).not.toThrow();
  });
});
