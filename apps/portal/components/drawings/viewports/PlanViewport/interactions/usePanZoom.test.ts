import { describe, expect, it } from 'vitest';
import type { ModelSpacePanSession } from '@/lib/drawings/interactions/modelSpaceNavigationController';
import { resolvePannedTransform, resolveWheelZoomedTransform } from './usePanZoom';

const IDENTITY = { zoom: 1, panX: 0, panY: 0 };

describe('resolveWheelZoomedTransform', () => {
  it('returns null when wheel delta is zero', () => {
    expect(
      resolveWheelZoomedTransform({
        transform: IDENTITY,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 0,
        anchor: { x: 100, y: 100 },
      }),
    ).toBeNull();
  });

  it('zooms out when deltaY is positive (typical mouse-wheel scroll-down)', () => {
    const next = resolveWheelZoomedTransform({
      transform: IDENTITY,
      deltaMode: 0,
      deltaX: 0,
      deltaY: 100,
      anchor: { x: 0, y: 0 },
    });
    expect(next).not.toBeNull();
    expect(next!.zoom).toBeLessThan(IDENTITY.zoom);
  });

  it('zooms in when deltaY is negative', () => {
    const next = resolveWheelZoomedTransform({
      transform: IDENTITY,
      deltaMode: 0,
      deltaX: 0,
      deltaY: -100,
      anchor: { x: 0, y: 0 },
    });
    expect(next).not.toBeNull();
    expect(next!.zoom).toBeGreaterThan(IDENTITY.zoom);
  });

  it('keeps the content under the anchor stationary across the zoom step', () => {
    const transform = { zoom: 1, panX: 50, panY: 30 };
    const anchor = { x: 200, y: 150 };
    const before = {
      x: (anchor.x - transform.panX) / transform.zoom,
      y: (anchor.y - transform.panY) / transform.zoom,
    };
    const next = resolveWheelZoomedTransform({
      transform,
      deltaMode: 0,
      deltaX: 0,
      deltaY: -120,
      anchor,
    });
    expect(next).not.toBeNull();
    const after = {
      x: (anchor.x - next!.panX) / next!.zoom,
      y: (anchor.y - next!.panY) / next!.zoom,
    };
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('respects the zoom clamp on extreme scroll input', () => {
    const next = resolveWheelZoomedTransform({
      transform: IDENTITY,
      deltaMode: 0,
      deltaX: 0,
      deltaY: -100000,
      anchor: { x: 0, y: 0 },
    });
    expect(next).not.toBeNull();
    expect(next!.zoom).toBeLessThanOrEqual(4);
  });
});

describe('resolvePannedTransform', () => {
  function session(start: Partial<ModelSpacePanSession> = {}): ModelSpacePanSession {
    return {
      pointerId: 1,
      startClientX: 100,
      startClientY: 100,
      startPanX: 0,
      startPanY: 0,
      ...start,
    };
  }

  it('translates pan by the client delta from the session start', () => {
    const next = resolvePannedTransform({
      transform: IDENTITY,
      session: session(),
      clientX: 150,
      clientY: 130,
    });
    expect(next).toEqual({ zoom: 1, panX: 50, panY: 30 });
  });

  it('preserves the existing zoom value', () => {
    const next = resolvePannedTransform({
      transform: { zoom: 2.5, panX: 10, panY: 20 },
      session: session({ startPanX: 10, startPanY: 20 }),
      clientX: 110,
      clientY: 110,
    });
    expect(next.zoom).toBe(2.5);
    expect(next.panX).toBe(20);
    expect(next.panY).toBe(30);
  });
});
