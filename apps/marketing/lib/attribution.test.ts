import { describe, expect, it } from 'vitest';
import { getMarketingAttributionFromLocation } from './attribution';

describe('marketing browser attribution', () => {
  it('captures UTM values and Google click identifiers from the landing URL', () => {
    expect(
      getMarketingAttributionFromLocation({
        search: '?utm_source=google&utm_medium=cpc&utm_campaign=winter&gclid=g-123&gbraid=gb-456&wbraid=wb-789&name=Jamie',
        href: 'https://www.sanctuarypergolas.co.nz/contact?utm_source=google&gclid=g-123',
        referrer: 'https://www.google.com/',
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
      landingPage: 'https://www.sanctuarypergolas.co.nz/contact?utm_source=google&gclid=g-123',
      referrer: 'https://www.google.com/',
    });
  });
});
