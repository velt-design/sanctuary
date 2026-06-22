import { describe, expect, it } from 'vitest';
import { applyAssemblyPosition3D, applyHouseReferencePosition } from './applyAssemblyPosition';
import type { Assembly3D, AssemblyPosition, HouseReferenceGeometry } from './contracts';

function makeBaseAssembly(): Assembly3D {
  return {
    family: 'mono',
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: 6000, y: 0, z: 0 },
    },
    outline: [
      { x: 0, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 3000, z: 0 },
      { x: 0, y: 3000, z: 0 },
    ],
    attachmentEdge: {
      start: { x: 0, y: 0, z: 0 },
      end: { x: 6000, y: 0, z: 0 },
    },
    house: {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: null,
      footprint: [
        { x: 0, y: -1800, z: 0 },
        { x: 6000, y: -1800, z: 0 },
        { x: 6000, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
      model: null,
      attachmentTarget: null,
    },
    members: [],
    roofPlanes: [],
    roofCladdingPanels: [],
    supportConditions: [],
    quantityHooks: [],
    semantics: {
      connectionType: 'wall',
      roofType: 'mono',
      structuralZones: [],
    },
  };
}

describe('applyAssemblyPosition3D', () => {
  it('returns the assembly unchanged when position is null', () => {
    const assembly = makeBaseAssembly();
    const result = applyAssemblyPosition3D(assembly, null);
    expect(result).toBe(assembly);
  });

  it('translates outline points when position has only an origin offset', () => {
    const assembly = makeBaseAssembly();
    const position: AssemblyPosition = { origin: { x: 1500, y: 2000 }, rotationDeg: 0 };
    const result = applyAssemblyPosition3D(assembly, position);
    expect(result.outline[0]).toEqual({ x: 1500, y: 2000, z: 0 });
    expect(result.outline[1]).toEqual({ x: 7500, y: 2000, z: 0 });
    expect(result.outline[2]).toEqual({ x: 7500, y: 5000, z: 0 });
    expect(result.outline[3]).toEqual({ x: 1500, y: 5000, z: 0 });
  });

  it('rotates outline points around +Z then translates', () => {
    const assembly = makeBaseAssembly();
    const position: AssemblyPosition = { origin: { x: 1000, y: 2000 }, rotationDeg: 90 };
    const result = applyAssemblyPosition3D(assembly, position);
    // Local (0,0) -> rotation = (0,0) -> translate = (1000, 2000)
    expect(result.outline[0]!.x).toBeCloseTo(1000, 6);
    expect(result.outline[0]!.y).toBeCloseTo(2000, 6);
    // Local (6000, 0) rotated 90° = (0, 6000), translated = (1000, 8000)
    expect(result.outline[1]!.x).toBeCloseTo(1000, 6);
    expect(result.outline[1]!.y).toBeCloseTo(8000, 6);
    // Local (6000, 3000) rotated 90° = (-3000, 6000), translated = (-2000, 8000)
    expect(result.outline[2]!.x).toBeCloseTo(-2000, 6);
    expect(result.outline[2]!.y).toBeCloseTo(8000, 6);
  });

  it('does not transform the house reference geometry when assembly.house.position is null (legacy path)', () => {
    const assembly = makeBaseAssembly();
    const position: AssemblyPosition = { origin: { x: 1500, y: 2000 }, rotationDeg: 45 };
    const result = applyAssemblyPosition3D(assembly, position);
    // House is in legacy world coords (no per-house position). The pergola
    // transform must not touch it.
    expect(result.house.footprint).toBe(assembly.house.footprint);
  });

  it('transforms the house when assembly.house.position is set, independently of the pergola position', () => {
    // Milestone 12: house is a first-class spatial entity with its own
    // position routed through the boundary. The pergola transform doesn't
    // affect the house, and vice versa — each is applied independently.
    const assembly: Assembly3D = {
      ...makeBaseAssembly(),
      house: {
        ...makeBaseAssembly().house,
        // Footprint stored in HOUSE-LOCAL coords (origin at house bottom-left).
        footprint: [
          { x: 0, y: 0, z: 0 },
          { x: 6000, y: 0, z: 0 },
          { x: 6000, y: 1800, z: 0 },
          { x: 0, y: 1800, z: 0 },
        ],
        position: { origin: { x: -1000, y: -1800 }, rotationDeg: 0 },
      },
    };
    const pergolaPosition: AssemblyPosition = { origin: { x: 500, y: 0 }, rotationDeg: 0 };
    const result = applyAssemblyPosition3D(assembly, pergolaPosition);
    // Pergola translated by (500, 0).
    expect(result.outline[0]!.x).toBeCloseTo(500, 6);
    expect(result.outline[0]!.y).toBeCloseTo(0, 6);
    // House translated by ITS OWN position (-1000, -1800), not the pergola's.
    expect(result.house.footprint![0]!.x).toBeCloseTo(-1000, 6);
    expect(result.house.footprint![0]!.y).toBeCloseTo(-1800, 6);
    expect(result.house.footprint![2]!.x).toBeCloseTo(5000, 6);
    expect(result.house.footprint![2]!.y).toBeCloseTo(0, 6);
    // Position is consumed by the transform — null after the boundary call so
    // a subsequent applyAssemblyPosition3D call doesn't double-translate.
    expect(result.house.position).toBeNull();
  });

  it('applies house position even when pergola position is null', () => {
    // The early-return must not skip the house transform when the pergola
    // has no position but the house does.
    const assembly: Assembly3D = {
      ...makeBaseAssembly(),
      house: {
        ...makeBaseAssembly().house,
        footprint: [
          { x: 0, y: 0, z: 0 },
          { x: 6000, y: 0, z: 0 },
          { x: 6000, y: 1800, z: 0 },
          { x: 0, y: 1800, z: 0 },
        ],
        position: { origin: { x: 250, y: 750 }, rotationDeg: 90 },
      },
    };
    const result = applyAssemblyPosition3D(assembly, null);
    // House local (0,0) rotated 90° = (0,0) → translated = (250, 750).
    expect(result.house.footprint![0]!.x).toBeCloseTo(250, 6);
    expect(result.house.footprint![0]!.y).toBeCloseTo(750, 6);
    // House local (6000, 0) rotated 90° = (0, 6000) → translated = (250, 6750).
    expect(result.house.footprint![1]!.x).toBeCloseTo(250, 6);
    expect(result.house.footprint![1]!.y).toBeCloseTo(6750, 6);
    expect(result.house.position).toBeNull();
  });

  it('updates the datum frame to reflect the new world position', () => {
    const assembly = makeBaseAssembly();
    const position: AssemblyPosition = { origin: { x: 500, y: 1000 }, rotationDeg: 90 };
    const result = applyAssemblyPosition3D(assembly, position);
    expect(result.datum.origin.x).toBeCloseTo(500, 6);
    expect(result.datum.origin.y).toBeCloseTo(1000, 6);
    expect(result.datum.xAxis.x).toBeCloseTo(0, 6);
    expect(result.datum.xAxis.y).toBeCloseTo(1, 6);
    expect(result.datum.yAxis.x).toBeCloseTo(-1, 6);
    expect(result.datum.yAxis.y).toBeCloseTo(0, 6);
  });

  it('translates the attachment edge', () => {
    const assembly = makeBaseAssembly();
    const position: AssemblyPosition = { origin: { x: 1000, y: 500 }, rotationDeg: 0 };
    const result = applyAssemblyPosition3D(assembly, position);
    expect(result.attachmentEdge).toEqual({
      start: { x: 1000, y: 500, z: 0 },
      end: { x: 7000, y: 500, z: 0 },
    });
  });

  it('handles a null attachmentEdge', () => {
    const assembly = { ...makeBaseAssembly(), attachmentEdge: null };
    const position: AssemblyPosition = { origin: { x: 1000, y: 500 }, rotationDeg: 0 };
    const result = applyAssemblyPosition3D(assembly, position);
    expect(result.attachmentEdge).toBeNull();
  });

  it('an identity transform (origin=(0,0), rotationDeg=0) is a no-op for outline coords', () => {
    const assembly = makeBaseAssembly();
    const position: AssemblyPosition = { origin: { x: 0, y: 0 }, rotationDeg: 0 };
    const result = applyAssemblyPosition3D(assembly, position);
    for (let idx = 0; idx < assembly.outline.length; idx += 1) {
      expect(result.outline[idx]!.x).toBeCloseTo(assembly.outline[idx]!.x, 6);
      expect(result.outline[idx]!.y).toBeCloseTo(assembly.outline[idx]!.y, 6);
      expect(result.outline[idx]!.z).toBeCloseTo(assembly.outline[idx]!.z, 6);
    }
  });

  it('transforms house wall segments and roof eaves so snap targets land at world coords', () => {
    // End-to-end snap-target invariant: when the house is at a non-zero
    // position, the wall segments and roof eaves consumed by the snap engine
    // (`buildHouseSnapTargets`) must end up at the correct world coords after
    // the boundary runs. This locks the milestone-12 contract end-to-end.
    const assembly: Assembly3D = {
      ...makeBaseAssembly(),
      house: {
        ...makeBaseAssembly().house,
        position: { origin: { x: 1000, y: 500 }, rotationDeg: 0 },
        model: {
          houseId: 'house-main',
          footprint: [
            { x: 0, y: 0, z: 0 },
            { x: 6000, y: 0, z: 0 },
            { x: 6000, y: 1800, z: 0 },
            { x: 0, y: 1800, z: 0 },
          ],
          wallSegments: [
            {
              id: 'house-wall-front',
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
          roofPlanes: [],
          roofEaves: [
            {
              id: 'roof-eave-front',
              edgeKind: 'drain_eave',
              eaveLine: { start: { x: -450, y: -450, z: 2400 }, end: { x: 6450, y: -450, z: 2400 } },
              sourceEdgeId: 'edge-1',
              sourceRoofPlaneId: 'roof-front',
            },
          ],
          eave: {
            soffitDepthMm: null,
            fasciaHeightMm: null,
            gutterWidthMm: null,
            gutterDepthMm: null,
            gutterProjectionMm: null,
            eaveOverhangMm: null,
            soffitPolygons: null,
            fasciaPolygons: null,
            gutterLines: null,
            gutterBoundaries: null,
          },
        },
      },
    };
    const result = applyAssemblyPosition3D(assembly, null);
    // Wall segment line: local (0,0)→(6000,0), translated by (1000, 500) →
    // world (1000, 500)→(7000, 500). This is what `buildHouseSnapTargets`
    // surfaces as a `wall` snap line target.
    const wall = result.house.model!.wallSegments[0]!;
    expect(wall.line.start.x).toBeCloseTo(1000, 6);
    expect(wall.line.start.y).toBeCloseTo(500, 6);
    expect(wall.line.end.x).toBeCloseTo(7000, 6);
    expect(wall.line.end.y).toBeCloseTo(500, 6);
    // Roof eave: local (-450, -450, 2400)→(6450, -450, 2400), translated by
    // (1000, 500) on XY (Z stays). This is what `buildHouseSnapTargets`
    // surfaces as a `roof_eave` snap line target.
    const eave = result.house.model!.roofEaves![0]!;
    expect(eave.eaveLine.start.x).toBeCloseTo(550, 6);
    expect(eave.eaveLine.start.y).toBeCloseTo(50, 6);
    expect(eave.eaveLine.start.z).toBeCloseTo(2400, 6);
    expect(eave.eaveLine.end.x).toBeCloseTo(7450, 6);
    expect(eave.eaveLine.end.y).toBeCloseTo(50, 6);
  });
});

describe('applyHouseReferencePosition', () => {
  function makeBaseHouseReference(): HouseReferenceGeometry {
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint: [
        { x: 0, y: 0, z: 0 },
        { x: 8000, y: 0, z: 0 },
        { x: 8000, y: -6000, z: 0 },
        { x: 0, y: -6000, z: 0 },
      ],
      model: null,
      attachmentTarget: null,
      position: null,
    };
  }

  it('translates the house footprint by the position origin (rotation 0)', () => {
    // Object-owned house form at offset (10m east, 0m north). Footprint
    // local coords run from (0,0) to
    // (8000, -6000) mm; after translation they land at (10000, 0) to
    // (18000, -6000) mm in world space.
    const house = makeBaseHouseReference();
    const position: AssemblyPosition = {
      origin: { x: 10000, y: 0 },
      rotationDeg: 0,
    };
    const result = applyHouseReferencePosition(house, position);
    expect(result.footprint?.[0]).toEqual({ x: 10000, y: 0, z: 0 });
    expect(result.footprint?.[1]).toEqual({ x: 18000, y: 0, z: 0 });
    expect(result.footprint?.[2]).toEqual({ x: 18000, y: -6000, z: 0 });
    expect(result.footprint?.[3]).toEqual({ x: 10000, y: -6000, z: 0 });
  });

  it('clears the position field after applying it (no double-application risk)', () => {
    // Downstream `applyAssemblyPosition3D` calls would re-apply position
    // if it stayed set. This is the contract that lets the portal pass
    // the result straight into the scene builder without worrying about
    // who already applied the transform.
    const house = makeBaseHouseReference();
    const result = applyHouseReferencePosition(house, {
      origin: { x: 5000, y: 0 },
      rotationDeg: 0,
    });
    expect(result.position).toBeNull();
  });

  it('rotates the footprint 90 degrees around +Z then translates', () => {
    // Quarter turn: the (+x) axis maps to (+y), (-y) maps to (+x).
    // Local point (8000, 0) -> world (0, 8000); local (8000, -6000) ->
    // world (-6000, 8000). Applied translation lifts everything by (1000, 0).
    const house = makeBaseHouseReference();
    const result = applyHouseReferencePosition(house, {
      origin: { x: 1000, y: 0 },
      rotationDeg: 90,
    });
    expect(result.footprint?.[0]?.x).toBeCloseTo(1000, 6);
    expect(result.footprint?.[0]?.y).toBeCloseTo(0, 6);
    expect(result.footprint?.[1]?.x).toBeCloseTo(1000, 6);
    expect(result.footprint?.[1]?.y).toBeCloseTo(8000, 6);
    expect(result.footprint?.[2]?.x).toBeCloseTo(7000, 6);
    expect(result.footprint?.[2]?.y).toBeCloseTo(8000, 6);
  });
});
