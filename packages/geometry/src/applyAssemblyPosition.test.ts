import { describe, expect, it } from 'vitest';
import { applyAssemblyPosition3D } from './applyAssemblyPosition';
import type { Assembly3D, AssemblyPosition } from './contracts';

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

  it('does not transform the house reference geometry', () => {
    const assembly = makeBaseAssembly();
    const position: AssemblyPosition = { origin: { x: 1500, y: 2000 }, rotationDeg: 45 };
    const result = applyAssemblyPosition3D(assembly, position);
    // house.footprint should be byte-equal — the helper must not touch it.
    expect(result.house.footprint).toBe(assembly.house.footprint);
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
});
