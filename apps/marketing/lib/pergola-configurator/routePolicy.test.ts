import { describe, expect, it } from 'vitest';
import { getConfiguratorRoutePolicy } from './routePolicy';

describe('getConfiguratorRoutePolicy', () => {
  it.each([
    '/',
    '/index',
    '/pergolas-auckland',
    '/commercial-pergolas-auckland',
    '/architects-designers-builders',
    '/projects',
    '/projects/warkworth',
    '/products/pergolas/gable',
    '/pergola-guides',
    '/contact',
    '/simple-cover-calculator',
  ])('enables public discovery route %s after engagement', (pathname) => {
    expect(getConfiguratorRoutePolicy(pathname)).toMatchObject({
      enabled: true,
      initialDockVisibility: 'after_engagement',
      reason: 'public_discovery_route',
    });
  });

  it.each([
    '/quote/abc',
    '/invoice/abc',
    '/staff/projects',
    '/admin',
    '/pricebook/configurations',
    '/__foundation/marketing',
    '/home-guided',
    '/contact/thanks',
    '/privacy',
  ])('hides excluded route %s', (pathname) => {
    expect(getConfiguratorRoutePolicy(pathname)).toMatchObject({
      enabled: false,
      initialDockVisibility: 'hidden',
    });
  });

  it('fails unclassified routes closed', () => {
    expect(getConfiguratorRoutePolicy('/unknown-campaign')).toEqual({
      enabled: false,
      initialDockVisibility: 'hidden',
      reason: 'unclassified_route',
    });
  });
});
