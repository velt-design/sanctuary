import { describe, expect, it } from 'vitest';
import {
  normalizeGeometryConfig,
  solveAssembly3D,
  solvePergolaGeometry,
  type PergolaGeometryInput,
  type RawGeometryModuleInput,
  type RawHouseInput,
} from '@sp/geometry';

function makeRawHouseInput(): RawHouseInput {
  return {
    houseId: 'house-main',
    footprintPreset: 'straight',
    footprintParams: {
      widthM: '',
      offsetXM: '0',
      setbackM: '0',
      bandDepthM: '1.8',
      returnRunM: '2.4',
      recessWidthM: '2.4',
      recessDepthM: '1.2',
      leftLegRunM: '2.4',
      rightLegRunM: '2.4',
      sideRunM: '2.4',
    },
  };
}

function makePergolaInput(overrides: Partial<PergolaGeometryInput> = {}): PergolaGeometryInput {
  return {
    projectId: 'project-1',
    estimateId: 'estimate-1',
    designRequestId: 'design-1',
    family: 'mono',
    dimensions: {
      lengthM: '6',
      projectionM: '3',
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '0',
    },
    roof: {
      material: 'acrylic',
      pitchDeg: '5',
      overhangEnabled: false,
    },
    gable: {
      endFramesMode: 'outer_end_only',
      houseEaveGutterMode: 'house',
      outerEaveGutterMode: 'our',
    },
    connection: {
      type: 'soffit',
      attachmentSide: 'rear',
      attachmentStrategy: 'soffit_brackets',
    },
    supports: {
      postCount: '2',
      postCutHeightM: '2.4',
      postConnectionType: 'slab_anchors',
      ground: 'easy',
    },
    structural: {
      heights: { houseUndersideM: 2.4, outerUndersideM: 2.137, referenceUndersideM: 2.4 },
      profiles: {
        post: '90x90',
        rafter: '150x50',
        ledger: '100x50',
        supportBeam: '150x50',
        gutter: 'SP Gutter',
        ridge: '150x50',
        boxPerimeter: '300x50',
      },
      framing: { rafterCount: 11, rafterSpacingMm: 600 },
      drainage: {
        gutterType: 'sp_gutter',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    hostHouse: makeRawHouseInput(),
    ...overrides,
  };
}

function makeRawInput(): RawGeometryModuleInput {
  return {
    projectId: 'project-1',
    estimateId: 'estimate-1',
    designRequestId: 'design-1',
    pergolaStyle: 'pitched',
    boxPerimeterEnabled: false,
    roof: {
      material: 'acrylic',
      mode: null,
      slopeDirection: 'away_from_house',
      roofPitchDeg: '5',
      overhangEnabled: false,
      overhangM: null,
    },
    gable: {
      endFramesMode: 'outer_end_only',
      houseEaveGutter: 'house',
      outerEaveGutter: 'our',
    },
    box: {
      houseEdgeGutter: null,
      farEdgeGutter: null,
    },
    connection: {
      houseConnectionType: 'soffit',
      attachmentSide: 'rear',
    },
    position: null,
    supports: {
      postCount: '2',
      postCutHeightM: '2.4',
      postConnectionType: 'slab_anchors',
      ground: 'easy',
    },
    structural: {
      heights: { houseUndersideM: 2.4, outerUndersideM: 2.137, referenceUndersideM: 2.4 },
      profiles: {
        post: '90x90',
        rafter: '150x50',
        ledger: '100x50',
        supportBeam: '150x50',
        gutter: 'SP Gutter',
        ridge: '150x50',
        boxPerimeter: '300x50',
      },
      framing: { rafterCount: 11, rafterSpacingMm: 600 },
      drainage: {
        gutterType: 'sp_gutter',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      ...makeRawHouseInput(),
      attachmentStrategy: 'soffit_brackets',
    },
    dimensions: {
      lengthM: '6',
      projectionM: '3',
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '0',
    },
  };
}

describe('solvePergolaGeometry', () => {
  it('matches existing normalize plus solve output for a mono pergola', () => {
    const rawNormalize = normalizeGeometryConfig(makeRawInput());
    expect(rawNormalize.ok).toBe(true);
    if (!rawNormalize.ok) return;
    const rawSolve = solveAssembly3D(rawNormalize.value);
    expect(rawSolve.ok).toBe(true);
    if (!rawSolve.ok) return;

    const result = solvePergolaGeometry(makePergolaInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.config).toEqual(rawNormalize.value);
    expect(result.assembly.outline).toEqual(rawSolve.value.outline);
    expect(result.assembly.members.length).toBe(rawSolve.value.members.length);
    expect(result.viewerScene.layers.length).toBeGreaterThan(0);
    expect(result.topProjection.shapes.length).toBeGreaterThan(0);
    expect(result.plan.outline.length).toBeGreaterThan(0);
    expect(result.section.members.rafters.length).toBeGreaterThan(0);
    expect(result.quantityTakeoff.members.items.length).toBeGreaterThan(0);
  });

  it('supports gable and box families through the neutral input', () => {
    const gable = solvePergolaGeometry(makePergolaInput({
      family: 'gable',
      structural: {
        heights: { houseUndersideM: 2.4, outerUndersideM: 2.4, referenceUndersideM: 2.4 },
      },
    }));
    expect(gable.ok).toBe(true);
    if (gable.ok) expect(gable.config.family).toBe('gable');

    const box = solvePergolaGeometry(makePergolaInput({
      family: 'box',
      roof: { material: 'acrylic', pitchDeg: '5', boxPerimeterEnabled: true },
    }));
    expect(box.ok).toBe(true);
    if (box.ok) expect(box.config.family).toBe('box');
  });

  it('returns stable failures for invalid dimensions and unsupported family', () => {
    const invalidDimension = solvePergolaGeometry(makePergolaInput({
      dimensions: { lengthM: 'nope', projectionM: '3' },
    }));
    expect(invalidDimension).toMatchObject({
      ok: false,
      code: 'invalid_numeric_input',
    });

    const unsupported = solvePergolaGeometry(makePergolaInput({ family: 'unknown' }));
    expect(unsupported).toMatchObject({
      ok: false,
      code: 'unsupported_family',
    });
  });

  it('applies pergola position before building projections and scene output', () => {
    const result = solvePergolaGeometry(makePergolaInput({
      connection: { type: 'freestanding', attachmentSide: 'rear', attachmentStrategy: 'none' },
      hostHouse: null,
      supports: { postCount: '4', postCutHeightM: '2.4', postConnectionType: 'slab_anchors', ground: 'easy' },
      position: { origin: { x: 1200, y: -300 }, rotationDeg: 0 },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.assembly.datum.origin).toEqual({ x: 1200, y: -300, z: 0 });
    expect(result.topProjection.extents?.minX ?? 0).toBeGreaterThan(1000);
  });
});
