import { describe, expect, it } from 'vitest';
import type { SnapLineTarget } from '../interactions/snap/snapEngine';
import { resolveEdgeSnap } from './resolveEdgeSnap';

function eaveTarget(overrides: Partial<SnapLineTarget> = {}): SnapLineTarget {
  return {
    id: 'roof-eave-1',
    sourceObjectId: 'house-main',
    edgeKind: 'roof_eave',
    start: { x: 0, y: 1000 },
    end: { x: 6000, y: 1000 },
    ...overrides,
  };
}

describe('resolveEdgeSnap', () => {
  // Setup: a horizontal pergola edge along y=0, dragged outward in +y. Eave
  // at y=1000 (parallel, 1000mm away). Natural drag of 950mm should snap to
  // 1000 (within 250 default tolerance).

  it('snaps the natural delta to a parallel line target within tolerance', () => {
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 950,
      lineTargets: [eaveTarget()],
    });
    expect(result).not.toBeNull();
    expect(result?.target.edgeKind).toBe('roof_eave');
    expect(result?.snapDeltaMm).toBeCloseTo(1000, 6);
    expect(result?.correctionMm).toBeCloseTo(50, 6);
  });

  it('returns null when natural delta is outside tolerance', () => {
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 500,
      lineTargets: [eaveTarget()],
      toleranceMm: 250,
    });
    expect(result).toBeNull();
  });

  it('rejects non-parallel line targets even when in range', () => {
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 950,
      lineTargets: [
        // Diagonal line at ~9.5° from horizontal — outside default 5° tolerance.
        eaveTarget({ start: { x: 0, y: 1000 }, end: { x: 6000, y: 2000 } }),
      ],
    });
    expect(result).toBeNull();
  });

  it('treats antiparallel targets as parallel (180° flip is the same line)', () => {
    // Same line, reversed start/end. Should still snap.
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 1000,
      lineTargets: [eaveTarget({ start: { x: 6000, y: 1000 }, end: { x: 0, y: 1000 } })],
    });
    expect(result).not.toBeNull();
    expect(result?.snapDeltaMm).toBeCloseTo(1000, 6);
  });

  it('picks the closest target correction when multiple candidates are in range', () => {
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 950,
      lineTargets: [
        // Wall at y=900 (correction = 50)
        {
          id: 'wall-1',
          sourceObjectId: 'house-main',
          edgeKind: 'wall',
          start: { x: 0, y: 900 },
          end: { x: 6000, y: 900 },
        },
        // Eave at y=1000 (correction = 50, same magnitude)
        eaveTarget({ start: { x: 0, y: 1000 }, end: { x: 6000, y: 1000 } }),
        // Out-of-range line at y=2000 — should be filtered first
        {
          id: 'wall-2',
          sourceObjectId: 'house-main',
          edgeKind: 'wall',
          start: { x: 0, y: 2000 },
          end: { x: 6000, y: 2000 },
        },
      ],
      toleranceMm: 100,
    });
    expect(result).not.toBeNull();
    // Both wall@900 and eave@1000 have correction=50. First in iteration wins
    // (wall before eave), preserving the wall-default ordering from the
    // adapter.
    expect(result?.target.edgeKind).toBe('wall');
    expect(result?.snapDeltaMm).toBeCloseTo(900, 6);
  });

  it('respects angular tolerance — slightly tilted parallel lines still snap', () => {
    // 3° tilt — should be within default 5° tolerance.
    const tiltRad = (3 * Math.PI) / 180;
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 1000,
      lineTargets: [
        eaveTarget({
          start: { x: 0, y: 1000 },
          end: { x: 6000 * Math.cos(tiltRad), y: 1000 + 6000 * Math.sin(tiltRad) },
        }),
      ],
    });
    expect(result).not.toBeNull();
  });

  it('rejects targets that exceed angular tolerance', () => {
    // 10° tilt — exceeds default 5°.
    const tiltRad = (10 * Math.PI) / 180;
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 1000,
      lineTargets: [
        eaveTarget({
          start: { x: 0, y: 1000 },
          end: { x: 6000 * Math.cos(tiltRad), y: 1000 + 6000 * Math.sin(tiltRad) },
        }),
      ],
    });
    expect(result).toBeNull();
  });

  it('handles negative delta (drag into the polygon) by snapping inward', () => {
    // Edge at y=2000 (top of pergola), normal points +y, target at y=1500.
    // Natural delta = -480 (dragging inward toward the target line below).
    // Snap should set delta to -500 to land on target.
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 2000 },
      edgeEnd: { x: 6000, y: 2000 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: -480,
      lineTargets: [
        {
          id: 'wall-1',
          sourceObjectId: 'house-main',
          edgeKind: 'wall',
          start: { x: 0, y: 1500 },
          end: { x: 6000, y: 1500 },
        },
      ],
    });
    expect(result).not.toBeNull();
    expect(result?.snapDeltaMm).toBeCloseTo(-500, 6);
    expect(result?.correctionMm).toBeCloseTo(20, 6);
  });

  it('returns null when there are no line targets', () => {
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 6000, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 950,
      lineTargets: [],
    });
    expect(result).toBeNull();
  });

  it('returns null when the edge is degenerate (zero length)', () => {
    const result = resolveEdgeSnap({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 0, y: 0 },
      outwardNormal: { x: 0, y: 1 },
      naturalDeltaMm: 950,
      lineTargets: [eaveTarget()],
    });
    expect(result).toBeNull();
  });
});
