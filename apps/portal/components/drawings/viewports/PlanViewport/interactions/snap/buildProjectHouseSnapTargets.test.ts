import { describe, expect, it } from 'vitest';
import type { HouseModel3D } from '@sp/geometry';
import { buildProjectHouseSnapTargets } from './buildProjectHouseSnapTargets';

function makeMinimalHouseModel(id: string): HouseModel3D {
  return {
    houseId: id,
    footprint: [],
    wallSegments: [
      {
        id: `${id}-wall-1`,
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
    roofPlanes: [],
    roofEaves: [
      {
        id: `${id}-roof-eave-1`,
        edgeKind: 'drain_eave',
        eaveLine: {
          start: { x: -450, y: -450, z: 2400 },
          end: { x: 6450, y: -450, z: 2400 },
        },
        sourceEdgeId: 'footprint-edge-1',
        sourceRoofPlaneId: null,
      },
    ],
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
  };
}

describe('buildProjectHouseSnapTargets', () => {
  it('includes walls and eaves for every project house source during pergola edits', () => {
    const targets = buildProjectHouseSnapTargets({
      activeFamily: 'pergolas',
      projectHouseSnapSources: [
        { houseFormId: 'house-main', model: makeMinimalHouseModel('house-main') },
        { houseFormId: 'house-form-2', model: makeMinimalHouseModel('house-form-2') },
      ],
    });

    expect(targets.map((target) => target.sourceObjectId)).toEqual([
      'house-main',
      'house-main',
      'house-form-2',
      'house-form-2',
    ]);
    expect(targets.map((target) => target.edgeKind)).toEqual([
      'wall',
      'roof_eave',
      'wall',
      'roof_eave',
    ]);
  });

  it('includes only walls for every project house source during deck edits', () => {
    const targets = buildProjectHouseSnapTargets({
      activeFamily: 'decks',
      projectHouseSnapSources: [
        { houseFormId: 'house-main', model: makeMinimalHouseModel('house-main') },
        { houseFormId: 'house-form-2', model: makeMinimalHouseModel('house-form-2') },
      ],
    });

    expect(targets.map((target) => target.sourceObjectId)).toEqual([
      'house-main',
      'house-form-2',
    ]);
    expect(targets.every((target) => target.edgeKind === 'wall')).toBe(true);
  });

  it('falls back to the active artifact house when no project sources are provided', () => {
    const targets = buildProjectHouseSnapTargets({
      activeFamily: 'pergolas',
      projectHouseSnapSources: [],
      fallbackHouseModel: makeMinimalHouseModel('fallback-house'),
      fallbackHouseObjectId: 'fallback-house',
    });

    expect(targets).toHaveLength(2);
    expect(targets.every((target) => target.sourceObjectId === 'fallback-house')).toBe(true);
  });
});
