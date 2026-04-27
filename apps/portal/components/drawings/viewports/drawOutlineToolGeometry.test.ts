import { describe, expect, it } from 'vitest';
import {
  absoluteAngleDeg,
  buildDrawOutlinePreviewPolygon,
  distanceBetweenOutlinePoints,
  normalizeAngleDeg,
  outlinePointsToPolygon,
  resolveDrawOutlineHoverPoint,
  resolvePendingOutlinePoint,
} from './drawOutlineToolGeometry';
import type { DrawOutlineActiveToolState } from './drawOutlineToolState';

function makeState(overrides: Partial<DrawOutlineActiveToolState>): DrawOutlineActiveToolState {
  return {
    kind: 'active',
    status: 'placing',
    points: [],
    pendingPoint: null,
    hoverPoint: null,
    distanceDraft: '',
    angleDraft: '',
    angleMode: 'absolute',
    lockedDistanceDraft: null,
    previewSource: 'none',
    ...overrides,
  };
}

describe('drawOutlineToolGeometry', () => {
  it('calculates distances and absolute angles between outline points', () => {
    const start = { alongM: 0, depthM: 0 };
    expect(distanceBetweenOutlinePoints(start, { alongM: 3, depthM: 4 })).toBe(5);
    expect(absoluteAngleDeg(start, { alongM: 1, depthM: 0 })).toBe(0);
    expect(absoluteAngleDeg(start, { alongM: 0, depthM: 1 })).toBe(90);
    expect(absoluteAngleDeg(start, { alongM: -1, depthM: 0 })).toBe(180);
  });

  it('normalizes angles around negative and over-360 values', () => {
    expect(normalizeAngleDeg(-450)).toBe(-90);
    expect(normalizeAngleDeg(-181)).toBe(179);
    expect(normalizeAngleDeg(181)).toBe(-179);
    expect(normalizeAngleDeg(540)).toBe(180);
    expect(normalizeAngleDeg(Number.NaN)).toBe(0);
  });

  it('projects pending points from absolute distance and angle drafts', () => {
    const state = makeState({
      points: [{ alongM: 0, depthM: 0 }],
      distanceDraft: '2',
      angleDraft: '90',
      angleMode: 'absolute',
    });

    expect(resolvePendingOutlinePoint(state)).toEqual({ alongM: 0, depthM: 2 });
  });

  it('projects pending points from relative distance and angle drafts', () => {
    const state = makeState({
      points: [
        { alongM: 0, depthM: 0 },
        { alongM: 2, depthM: 0 },
      ],
      distanceDraft: '2',
      angleDraft: '90',
      angleMode: 'relative',
    });

    expect(resolvePendingOutlinePoint(state)).toEqual({ alongM: 2, depthM: 2 });
  });

  it('returns no pending point for invalid draft values', () => {
    expect(resolvePendingOutlinePoint(makeState({ points: [] }))).toBeNull();
    expect(resolvePendingOutlinePoint(makeState({ points: [{ alongM: 0, depthM: 0 }], distanceDraft: '0.0005', angleDraft: '0' }))).toBeNull();
    expect(resolvePendingOutlinePoint(makeState({ points: [{ alongM: 0, depthM: 0 }], distanceDraft: '2', angleDraft: 'nope' }))).toBeNull();
  });

  it('detects close hover inside and outside tolerance', () => {
    const points = [
      { alongM: 0, depthM: 0 },
      { alongM: 3, depthM: 0 },
      { alongM: 3, depthM: 2 },
    ];

    expect(resolveDrawOutlineHoverPoint(points, { alongM: 0.1, depthM: 0.1 })).toEqual({
      point: { alongM: 0, depthM: 0 },
      closeHovered: true,
    });
    expect(resolveDrawOutlineHoverPoint(points, { alongM: 0.3, depthM: 0 })).toEqual({
      point: { alongM: 0.3, depthM: 0 },
      closeHovered: false,
    });
  });

  it('assembles preview polygons for confirmed, hover, and pending points', () => {
    const points = [{ alongM: 0, depthM: 0 }];
    expect(buildDrawOutlinePreviewPolygon(points, null)).toEqual([{ alongM: '0', depthM: '0' }]);
    expect(buildDrawOutlinePreviewPolygon(points, { alongM: 2, depthM: 0 })).toEqual([
      { alongM: '0', depthM: '0' },
      { alongM: '2', depthM: '0' },
    ]);
    expect(buildDrawOutlinePreviewPolygon(points, { alongM: 0, depthM: 2 })).toEqual([
      { alongM: '0', depthM: '0' },
      { alongM: '0', depthM: '2' },
    ]);
  });

  it('serializes outline points with metre formatting', () => {
    expect(
      outlinePointsToPolygon([
        { alongM: 1.23456, depthM: 0 },
        { alongM: -0.0004, depthM: 2.5 },
      ]),
    ).toEqual([
      { alongM: '1.235', depthM: '0' },
      { alongM: '0', depthM: '2.5' },
    ]);
  });
});
