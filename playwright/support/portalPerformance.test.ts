import { describe, expect, it } from 'vitest';
import {
  assertResponsivePortalJourneyHasNoBlockingOverlay,
  parsePortalServerTiming,
  portalApiRouteTemplate,
} from './portalPerformance';

describe('responsive portal performance gate', () => {
  it.each(['warm-navigation', 'interaction'] as const)(
    'fails a %s journey that displayed a blocking overlay',
    (kind) => {
      expect(() => assertResponsivePortalJourneyHasNoBlockingOverlay({
        name: 'responsive-journey',
        kind,
        blockingOverlaySeen: true,
      })).toThrow(/responsive-journey.*blocking or generic loading overlay/);
    },
  );

  it('accepts responsive journeys that never displayed a blocking overlay', () => {
    expect(() => assertResponsivePortalJourneyHasNoBlockingOverlay({
      name: 'warm-projects',
      kind: 'warm-navigation',
      blockingOverlaySeen: false,
    })).not.toThrow();
  });
});

describe('portal API performance diagnostics', () => {
  it('records route structure and query keys without customer identifiers or values', () => {
    expect(portalApiRouteTemplate(
      'https://portal.example/api/staff/v1/projects/proj_f8ecc399-f303-493a-addb-bfecab92aff5/summary?tab=activity&customer=Geoff',
    )).toEqual({
      route: '/api/staff/v1/projects/[projectId]/summary',
      queryKeys: ['customer', 'tab'],
    });
  });

  it('retains only timing names and durations from Server-Timing', () => {
    expect(parsePortalServerTiming(
      'total;dur=812.47;desc="customer Geoff", db;dur=640.2, cache;desc="miss"',
    )).toEqual([
      { name: 'total', durationMs: 812.5 },
      { name: 'db', durationMs: 640.2 },
      { name: 'cache', durationMs: null },
    ]);
  });
});
