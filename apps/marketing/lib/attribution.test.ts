import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBrowserMarketingAttribution,
  getGaClientIdFromCookie,
  getMarketingAttributionFromLocation,
} from './attribution';

describe('marketing browser attribution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('captures campaign values while stripping query and hash data from stored URLs', () => {
    expect(
      getMarketingAttributionFromLocation({
        search: '?utm_source=google&utm_medium=cpc&utm_campaign=winter&gclid=g-123&gbraid=gb-456&wbraid=wb-789&name=Jamie',
        href: 'https://www.sanctuarypergolas.co.nz/contact?utm_source=google&gclid=g-123#form',
        referrer: 'https://www.google.com/search?q=pergolas#results',
      }),
    ).toEqual({
      utm: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'winter',
      },
      clickIds: {
        gclid: 'g-123',
        gbraid: 'gb-456',
        wbraid: 'wb-789',
      },
      landingPage: 'https://www.sanctuarypergolas.co.nz/contact',
      referrer: 'https://www.google.com/search',
    });
  });

  it('extracts only a valid GA client id from the first-party _ga cookie', () => {
    expect(getGaClientIdFromCookie('theme=light; _ga=GA1.1.1022420085.1772518636; other=value')).toBe(
      '1022420085.1772518636',
    );
    expect(getGaClientIdFromCookie('_ga=invalid')).toBeNull();
    expect(getGaClientIdFromCookie('_ga_KGLF83X6JW=GS2.1.s123$o1')).toBeNull();
  });

  it('captures consented analytics identity and suppresses all marketing attribution without marketing consent', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?utm_source=google&gclid=g-123',
        href: 'https://www.sanctuarypergolas.co.nz/contact?utm_source=google&gclid=g-123',
      },
    });
    vi.stubGlobal('document', {
      referrer: 'https://www.google.com/',
      cookie: '_ga=GA1.1.1022420085.1772518636',
    });

    const result = getBrowserMarketingAttribution({
      consent: { analytics: true, marketing: false },
      hasStoredChoice: true,
    });

    expect(result).toMatchObject({
      utm: {},
      clickIds: {},
      analyticsClientId: '1022420085.1772518636',
      consent: {
        analytics: true,
        marketing: false,
      },
    });
    expect(result).not.toHaveProperty('landingPage');
    expect(result).not.toHaveProperty('referrer');
    expect(result.consent?.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not read the GA cookie until analytics consent is explicitly granted', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?utm_source=google&gclid=g-123',
        href: 'https://www.sanctuarypergolas.co.nz/contact?gclid=g-123#form',
      },
    });
    vi.stubGlobal('document', {
      referrer: 'https://www.google.com/search?q=pergolas',
      cookie: '_ga=GA1.1.1022420085.1772518636',
    });

    expect(
      getBrowserMarketingAttribution({
        consent: { analytics: false, marketing: true },
        hasStoredChoice: true,
      }),
    ).toMatchObject({
      utm: { utm_source: 'google' },
      clickIds: { gclid: 'g-123' },
      landingPage: 'https://www.sanctuarypergolas.co.nz/contact',
      referrer: 'https://www.google.com/search',
      consent: { analytics: false, marketing: true },
    });
    expect(
      getBrowserMarketingAttribution({
        consent: { analytics: false, marketing: true },
        hasStoredChoice: true,
      }),
    ).not.toHaveProperty('analyticsClientId');
  });

  it('treats an unmade consent choice as denied when preparing a submission', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?utm_source=google&gclid=g-123',
        href: 'https://www.sanctuarypergolas.co.nz/contact?utm_source=google&gclid=g-123',
      },
    });
    vi.stubGlobal('document', {
      referrer: '',
      cookie: '_ga=GA1.1.1022420085.1772518636',
    });

    expect(
      getBrowserMarketingAttribution({
        consent: { analytics: true, marketing: true },
        hasStoredChoice: false,
      }),
    ).toMatchObject({
      utm: {},
      clickIds: {},
      consent: { analytics: false, marketing: false },
    });
    expect(
      getBrowserMarketingAttribution({
        consent: { analytics: true, marketing: true },
        hasStoredChoice: false,
      }),
    ).not.toHaveProperty('landingPage');
  });
});
