import { describe, expect, it } from 'vitest';
import type { HouseModel3D } from '@sp/geometry';
import { buildHouseSnapTargets } from './buildHouseSnapTargets';

function makeMinimalHouseModel(overrides: Partial<HouseModel3D> = {}): HouseModel3D {
  return {
    footprint: [],
    wallSegments: [],
    roofPlanes: [],
    eave: {
      soffitDepthMm: 600,
      fasciaHeightMm: 180,
      gutterWidthMm: 125,
      gutterDepthMm: 90,
      gutterProjectionMm: 100,
      eaveOverhangMm: 450,
      gutterLines: [],
      gutterBoundaries: [],
      fasciaPolygons: [],
      soffitPolygons: [],
      metadata: {},
    },
    ...overrides,
  };
}

describe('buildHouseSnapTargets', () => {
  it('returns an empty array when houseModel is null/undefined', () => {
    expect(buildHouseSnapTargets({ houseModel: null, houseObjectId: 'house-1' })).toEqual([]);
    expect(buildHouseSnapTargets({ houseModel: undefined, houseObjectId: 'house-1' })).toEqual([]);
  });

  it('projects wall segments to plan-space line targets with wall edgeKind and stable ids', () => {
    const houseModel = makeMinimalHouseModel({
      wallSegments: [
        {
          id: 'house-wall-1',
          line: { start: { x: 0, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } },
          plane: {
            origin: { x: 0, y: 0, z: 0 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 0, z: 1 },
            normal: { x: 0, y: -1, z: 0 },
          },
          boundary: [],
          sourceEdgeId: 'footprint-edge-1',
        },
      ],
    });
    const targets = buildHouseSnapTargets({ houseModel, houseObjectId: 'house-main' });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({
      id: 'wall-house-wall-1',
      sourceObjectId: 'house-main',
      edgeKind: 'wall',
      start: { x: 0, y: 0 },
      end: { x: 6000, y: 0 },
    });
  });

  it('projects roof eaves to plan-space line targets with roof_eave edgeKind', () => {
    const houseModel = makeMinimalHouseModel({
      roofEaves: [
        {
          id: 'roof-eave-footprint-edge-1',
          edgeKind: 'drain_eave',
          eaveLine: {
            start: { x: -450, y: -2250, z: 2400 },
            end: { x: 6450, y: -2250, z: 2400 },
          },
          sourceEdgeId: 'footprint-edge-1',
          sourceRoofPlaneId: 'house-roof-min-y',
        },
      ],
    });
    const targets = buildHouseSnapTargets({ houseModel, houseObjectId: 'house-main' });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({
      id: 'roof-eave-footprint-edge-1',
      sourceObjectId: 'house-main',
      edgeKind: 'roof_eave',
      start: { x: -450, y: -2250 },
      end: { x: 6450, y: -2250 },
    });
  });

  it('produces walls before eaves so wall snaps win priority ties on identical alignment', () => {
    // Walls and eaves can be coincident in 2D for an attached pergola at gutter
    // height. Ordering is the only signal the engine has when distances are
    // equal — walls first means the resulting attachment defaults to
    // `spatialKind: 'wall'` for ambiguous proximity, and the user must drag
    // further out to get `spatialKind: 'roof_edge'`. This matches the doc's
    // rule table: wall snap is the default; roof-edge requires the eave to
    // be the closer line.
    const houseModel = makeMinimalHouseModel({
      wallSegments: [
        {
          id: 'house-wall-1',
          line: { start: { x: 0, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } },
          plane: {
            origin: { x: 0, y: 0, z: 0 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 0, z: 1 },
            normal: { x: 0, y: -1, z: 0 },
          },
          boundary: [],
        },
      ],
      roofEaves: [
        {
          id: 'roof-eave-edge-1',
          edgeKind: 'drain_eave',
          eaveLine: {
            start: { x: 0, y: 0, z: 2400 },
            end: { x: 6000, y: 0, z: 2400 },
          },
          sourceEdgeId: 'footprint-edge-1',
          sourceRoofPlaneId: null,
        },
      ],
    });
    const targets = buildHouseSnapTargets({ houseModel, houseObjectId: 'house-main' });
    expect(targets[0]?.edgeKind).toBe('wall');
    expect(targets[1]?.edgeKind).toBe('roof_eave');
  });

  it('combines walls and eaves when both are present', () => {
    const houseModel = makeMinimalHouseModel({
      wallSegments: [
        {
          id: 'house-wall-1',
          line: { start: { x: 0, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } },
          plane: {
            origin: { x: 0, y: 0, z: 0 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 0, z: 1 },
            normal: { x: 0, y: -1, z: 0 },
          },
          boundary: [],
        },
        {
          id: 'house-wall-2',
          line: { start: { x: 6000, y: 0, z: 0 }, end: { x: 6000, y: 3000, z: 0 } },
          plane: {
            origin: { x: 6000, y: 0, z: 0 },
            xAxis: { x: 0, y: 1, z: 0 },
            yAxis: { x: 0, y: 0, z: 1 },
            normal: { x: 1, y: 0, z: 0 },
          },
          boundary: [],
        },
      ],
      roofEaves: [
        {
          id: 'roof-eave-1',
          edgeKind: 'drain_eave',
          eaveLine: {
            start: { x: -450, y: -2250, z: 2400 },
            end: { x: 6450, y: -2250, z: 2400 },
          },
          sourceEdgeId: 'footprint-edge-1',
          sourceRoofPlaneId: null,
        },
      ],
    });
    const targets = buildHouseSnapTargets({ houseModel, houseObjectId: 'house-main' });
    expect(targets).toHaveLength(3);
    expect(targets.map((target) => target.edgeKind)).toEqual(['wall', 'wall', 'roof_eave']);
  });

  it("kinds='walls' omits roof eaves so deck edge drags don't snap to gutter-height edges", () => {
    // Step 11: decks sit at ground level. Snapping a deck edge to a roof eave
    // (gutter height) would lock the deck onto an edge it physically can't
    // attach to. The kinds option lets the deck wiring request walls only.
    const houseModel = makeMinimalHouseModel({
      wallSegments: [
        {
          id: 'house-wall-1',
          line: { start: { x: 0, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } },
          plane: {
            origin: { x: 0, y: 0, z: 0 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 0, z: 1 },
            normal: { x: 0, y: -1, z: 0 },
          },
          boundary: [],
        },
      ],
      roofEaves: [
        {
          id: 'roof-eave-edge-1',
          edgeKind: 'drain_eave',
          eaveLine: {
            start: { x: -450, y: -2250, z: 2400 },
            end: { x: 6450, y: -2250, z: 2400 },
          },
          sourceEdgeId: 'footprint-edge-1',
          sourceRoofPlaneId: null,
        },
      ],
    });
    const targets = buildHouseSnapTargets({
      houseModel,
      houseObjectId: 'house-main',
      kinds: 'walls',
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.edgeKind).toBe('wall');
  });

  it("kinds='walls_and_eaves' is the default and matches the no-flag behaviour", () => {
    const houseModel = makeMinimalHouseModel({
      wallSegments: [
        {
          id: 'house-wall-1',
          line: { start: { x: 0, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } },
          plane: {
            origin: { x: 0, y: 0, z: 0 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 0, z: 1 },
            normal: { x: 0, y: -1, z: 0 },
          },
          boundary: [],
        },
      ],
      roofEaves: [
        {
          id: 'roof-eave-1',
          edgeKind: 'drain_eave',
          eaveLine: {
            start: { x: 0, y: 0, z: 2400 },
            end: { x: 6000, y: 0, z: 2400 },
          },
          sourceEdgeId: 'footprint-edge-1',
          sourceRoofPlaneId: null,
        },
      ],
    });
    const defaulted = buildHouseSnapTargets({ houseModel, houseObjectId: 'house-main' });
    const explicit = buildHouseSnapTargets({
      houseModel,
      houseObjectId: 'house-main',
      kinds: 'walls_and_eaves',
    });
    expect(defaulted).toEqual(explicit);
    expect(defaulted.map((t) => t.edgeKind)).toEqual(['wall', 'roof_eave']);
  });

  it('uses the same houseObjectId on every emitted target for the same model', () => {
    const houseModel = makeMinimalHouseModel({
      wallSegments: [
        {
          id: 'house-wall-1',
          line: { start: { x: 0, y: 0, z: 0 }, end: { x: 6000, y: 0, z: 0 } },
          plane: {
            origin: { x: 0, y: 0, z: 0 },
            xAxis: { x: 1, y: 0, z: 0 },
            yAxis: { x: 0, y: 0, z: 1 },
            normal: { x: 0, y: -1, z: 0 },
          },
          boundary: [],
        },
      ],
      roofEaves: [
        {
          id: 'roof-eave-1',
          edgeKind: 'drain_eave',
          eaveLine: {
            start: { x: 0, y: 0, z: 2400 },
            end: { x: 6000, y: 0, z: 2400 },
          },
          sourceEdgeId: 'footprint-edge-1',
          sourceRoofPlaneId: null,
        },
      ],
    });
    const targets = buildHouseSnapTargets({ houseModel, houseObjectId: 'house-form-A' });
    for (const target of targets) {
      expect(target.sourceObjectId).toBe('house-form-A');
    }
  });
});
