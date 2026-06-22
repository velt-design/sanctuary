import { describe, expect, it } from 'vitest';
import {
  applyAnchoredPlanZoom,
  clampPlanZoom,
  normalizeWheelDeltaPixels,
} from './planNavigationController';

describe('planNavigationController', () => {
  it('clamps zoom to the plan editor limits', () => {
    expect(clampPlanZoom(0)).toBe(0.01);
    expect(clampPlanZoom(2)).toBe(2);
    expect(clampPlanZoom(10)).toBe(4);
  });

  it('normalizes wheel deltas across pixel, line, and page modes', () => {
    expect(normalizeWheelDeltaPixels({ deltaMode: 0, deltaX: 2, deltaY: -3 })).toEqual({
      deltaX: 2,
      deltaY: -3,
    });
    expect(normalizeWheelDeltaPixels({ deltaMode: 1, deltaX: 2, deltaY: -3 })).toEqual({
      deltaX: 32,
      deltaY: -48,
    });
    expect(normalizeWheelDeltaPixels({ deltaMode: 2, deltaX: 2, deltaY: -3 })).toEqual({
      deltaX: 480,
      deltaY: -720,
    });
  });

  it('keeps the content anchor stable when zooming around a pointer', () => {
    const next = applyAnchoredPlanZoom({
      currentTransform: { zoom: 1, panX: 0, panY: 0 },
      nextZoom: 2,
      startZoom: 1,
      startPanX: 40,
      startPanY: 20,
      startAnchorX: 300,
      startAnchorY: 240,
      currentAnchorX: 320,
      currentAnchorY: 250,
    });

    expect(next).toEqual({
      zoom: 2,
      panX: -200,
      panY: -190,
    });
  });
});
