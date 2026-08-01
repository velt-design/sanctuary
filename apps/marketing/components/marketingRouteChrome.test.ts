import { describe, expect, it } from 'vitest';
import {
  shouldHideMarketingFooter,
  shouldHideMarketingHeader,
} from './marketingRouteChrome';

describe('marketing route chrome', () => {
  it('removes competing global chrome from the guided homepage', () => {
    expect(shouldHideMarketingHeader('/home-journey')).toBe(true);
    expect(shouldHideMarketingFooter('/home-journey')).toBe(true);
  });

  it('preserves the standard marketing shell elsewhere', () => {
    expect(shouldHideMarketingHeader('/')).toBe(false);
    expect(shouldHideMarketingFooter('/')).toBe(false);
    expect(shouldHideMarketingHeader('/projects')).toBe(false);
    expect(shouldHideMarketingFooter('/projects')).toBe(true);
  });

  it('keeps public-token and portal routes shellless', () => {
    for (const path of [
      '/quote/token',
      '/invoice/token',
      '/staff/projects',
      '/admin/users',
      '/pricebook/items',
    ]) {
      expect(shouldHideMarketingHeader(path)).toBe(true);
      expect(shouldHideMarketingFooter(path)).toBe(true);
    }
  });
});

