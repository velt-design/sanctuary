import { describe, expect, it } from 'vitest';
import { assertResponsivePortalJourneyHasNoBlockingOverlay } from './portalPerformance';

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
