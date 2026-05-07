import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { buildOtherPergolaSnapTargets } from './buildOtherPergolaSnapTargets';

function pergolaShape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'pergola_reference:pergola-1',
    sourceObjectId: 'pergola-1',
    sourceId: 'pergola-1',
    sourceType: 'pergola_reference',
    family: 'pergola',
    kind: 'outline',
    polygon: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    zOrder: 1,
    zMin: 0,
    zMax: 0,
    metadata: { isCanonicalOutline: true },
    ...overrides,
  };
}

describe('buildOtherPergolaSnapTargets (step 10)', () => {
  // Each pergola_reference outline becomes N line snap targets — one per
  // polygon edge — so the snap engine can match a dragged pergola edge
  // against any edge of any other pergola in the project. The resulting
  // attachment's `host.objectFamily` is 'pergolas' (per
  // `pergolaAttachmentFromSnap` semantics).

  it('emits one snap target per polygon edge of each pergola_reference shape', () => {
    const targets = buildOtherPergolaSnapTargets({
      shapes: [pergolaShape({ sourceObjectId: 'pergola-1' })],
    });
    expect(targets).toHaveLength(4);
    expect(targets[0]).toEqual({
      id: 'pergola-edge-pergola-1-0',
      sourceObjectId: 'pergola-1',
      edgeKind: 'pergola_outline',
      start: { x: 0, y: 0 },
      end: { x: 6000, y: 0 },
    });
    expect(targets[3]).toEqual({
      id: 'pergola-edge-pergola-1-3',
      sourceObjectId: 'pergola-1',
      edgeKind: 'pergola_outline',
      start: { x: 0, y: 3000 },
      end: { x: 0, y: 0 },
    });
  });

  it('combines edges from multiple pergolas into one flat list', () => {
    const targets = buildOtherPergolaSnapTargets({
      shapes: [
        pergolaShape({
          sourceObjectId: 'pergola-1',
          polygon: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
          ],
        }),
        pergolaShape({
          sourceObjectId: 'pergola-2',
          polygon: [
            { x: 2000, y: 0 },
            { x: 3000, y: 0 },
            { x: 3000, y: 1000 },
            { x: 2000, y: 1000 },
          ],
        }),
      ],
    });
    expect(targets).toHaveLength(3 + 4);
    expect(targets.filter((t) => t.sourceObjectId === 'pergola-1')).toHaveLength(3);
    expect(targets.filter((t) => t.sourceObjectId === 'pergola-2')).toHaveLength(4);
  });

  it('marks every emitted target with edgeKind=pergola_outline so attachment derivation routes correctly', () => {
    const targets = buildOtherPergolaSnapTargets({
      shapes: [
        pergolaShape({ sourceObjectId: 'pergola-1' }),
        pergolaShape({ sourceObjectId: 'pergola-2' }),
      ],
    });
    for (const target of targets) {
      expect(target.edgeKind).toBe('pergola_outline');
    }
  });

  it('skips non-pergola shapes (the input is already filtered upstream but we defend defensively)', () => {
    const targets = buildOtherPergolaSnapTargets({
      shapes: [
        // House reference — should not produce pergola edge targets.
        {
          id: 'house_reference:house-form-A',
          sourceObjectId: 'house-form-A',
          sourceId: 'house-form-A',
          sourceType: 'house_reference',
          family: 'house',
          kind: 'footprint',
          polygon: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 3000 },
            { x: 0, y: 3000 },
          ],
          zOrder: 0,
          zMin: 0,
          zMax: 0,
          metadata: { isCanonicalOutline: true },
        },
        pergolaShape({ sourceObjectId: 'pergola-1' }),
      ],
    });
    expect(targets).toHaveLength(4);
    expect(targets.every((target) => target.sourceObjectId === 'pergola-1')).toBe(true);
  });

  it('skips shapes with degenerate polygons (< 3 vertices)', () => {
    const targets = buildOtherPergolaSnapTargets({
      shapes: [
        pergolaShape({
          sourceObjectId: 'pergola-degenerate',
          polygon: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
          ],
        }),
        pergolaShape({ sourceObjectId: 'pergola-1' }),
      ],
    });
    expect(targets.every((target) => target.sourceObjectId === 'pergola-1')).toBe(true);
  });

  it('returns an empty array when input is empty', () => {
    expect(buildOtherPergolaSnapTargets({ shapes: [] })).toEqual([]);
  });

  it('produces stable ids that round-trip through the snap engine for re-solve recovery', () => {
    // Edge ids include both the source pergola id and the local edge index.
    // After a snap commit, the persisted attachment carries
    // `host.edgeId: 'pergola-edge-pergola-2-3'` — re-solves regenerate the
    // same id from the same pergola assembly + edge index, so attachment
    // recovery is deterministic.
    const targets = buildOtherPergolaSnapTargets({
      shapes: [pergolaShape({ sourceObjectId: 'pergola-2' })],
    });
    expect(targets.map((t) => t.id)).toEqual([
      'pergola-edge-pergola-2-0',
      'pergola-edge-pergola-2-1',
      'pergola-edge-pergola-2-2',
      'pergola-edge-pergola-2-3',
    ]);
    // Same input → same output (referentially-stable ids across solves).
    const targets2 = buildOtherPergolaSnapTargets({
      shapes: [pergolaShape({ sourceObjectId: 'pergola-2' })],
    });
    expect(targets2.map((t) => t.id)).toEqual(targets.map((t) => t.id));
  });
});
