import { describe, expect, it } from 'vitest';
import {
  normalizeGeometryConfig,
  solveAssembly3D,
  solveProject,
  type RawGeometryModuleInput,
  type RawHouseInput,
} from '@sp/geometry';

/**
 * Phase 3 of milestone 13 (drop pergola `houseContext` wrapping). The
 * `solveProject` orchestrator MUST produce per-pergola output equivalent
 * to calling `normalizeGeometryConfig + solveAssembly3D` directly. This
 * is the safety net for the eventual real dedup of `HouseModel3D`
 * building (phase 6 or later) -- if those phases drift the output, this
 * test catches it.
 */

function makeRawPergolaInput(overrides: {
  projectId?: string;
  pergolaId?: string;
  attachmentSide?: 'rear' | 'front' | 'left' | 'right';
} = {}): RawGeometryModuleInput {
  return {
    projectId: overrides.projectId ?? 'proj_1',
    estimateId: 'est_1',
    designRequestId: 'dpr_1',
    moduleId: overrides.pergolaId ?? 'mod_1',
    pergolaStyle: 'pitched',
    boxPerimeterEnabled: false,
    roof: {
      material: 'acrylic',
      mode: null,
      slopeDirection: 'away_from_house',
      roofPitchDeg: '5',
      overhangEnabled: false,
      overhangM: 0,
    },
    gable: {
      endFramesMode: 'outer_end_only',
      houseEaveGutter: 'house',
      outerEaveGutter: 'our',
    },
    box: {
      houseEdgeGutter: 'house',
      farEdgeGutter: 'our',
    },
    connection: {
      houseConnectionType: 'soffit',
      attachmentSide: overrides.attachmentSide ?? 'rear',
    },
    supports: {
      postMode: 'standard',
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
    },
    dimensions: {
      lengthM: '6',
      projectionM: '3',
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '0',
    },
    derived: {
      lengthM: null,
      projectionM: null,
      roofPitchDeg: null,
      slopeDirection: null,
      effectiveRunM: null,
      acrylicRequiredDownslopeM: null,
      joinerPieceLengthM: null,
      joinerRunsTotal: null,
      rafterHouseAllowanceM: null,
      rafterFarAllowanceM: null,
      acrylicAreaM2: null,
      boxEffectiveRunM: null,
      boxRiseMm: null,
      boxMaxFallMm: null,
    },
  };
}

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

describe('solveProject (milestone 13 phase 3)', () => {
  it('produces output equivalent to direct per-pergola normalize + solveAssembly3D', () => {
    const rawPergola = makeRawPergolaInput();
    const rawHouse = makeRawHouseInput();

    // Direct path: per-pergola normalize + solve.
    const directNormalize = normalizeGeometryConfig(rawPergola);
    expect(directNormalize.ok).toBe(true);
    if (!directNormalize.ok) return;
    const directSolve = solveAssembly3D(directNormalize.value);
    expect(directSolve.ok).toBe(true);
    if (!directSolve.ok) return;

    // Orchestrator path.
    const project = solveProject({ rawHouse, rawPergolas: [rawPergola] });
    expect(project.pergolas).toHaveLength(1);
    const projectPergola = project.pergolas[0];
    expect(projectPergola?.ok).toBe(true);
    if (!projectPergola || !projectPergola.ok) return;

    // Equivalence: top-level Assembly3D shape matches.
    expect(projectPergola.value.family).toBe(directSolve.value.family);
    expect(projectPergola.value.outline).toEqual(directSolve.value.outline);
    expect(projectPergola.value.members.length).toBe(directSolve.value.members.length);
    expect(projectPergola.value.house.model?.wallSegments.length ?? 0).toBe(
      directSolve.value.house.model?.wallSegments.length ?? 0,
    );
  });

  it('handles a multi-pergola project: each pergola gets its own Assembly3D, all reference the shared house', () => {
    const rawHouse = makeRawHouseInput();
    const rawPergolas = [
      makeRawPergolaInput({ pergolaId: 'pergola-rear', attachmentSide: 'rear' }),
      makeRawPergolaInput({ pergolaId: 'pergola-front', attachmentSide: 'front' }),
    ];

    const project = solveProject({ rawHouse, rawPergolas });
    expect(project.pergolas).toHaveLength(2);
    expect(project.pergolas.every((p) => p.ok)).toBe(true);

    // Both pergolas got their own Assembly3D with a fully-built house body.
    // Outline shape is the same (same pergola dimensions); the difference is
    // in connection.attachmentSide which affects datum + attachment edge but
    // not the local-frame outline. Independence is verified by both having
    // populated house models and matching pergolaIndex.
    const ok0 = project.pergolas[0];
    const ok1 = project.pergolas[1];
    if (ok0?.ok && ok1?.ok) {
      expect(ok0.pergolaIndex).toBe(0);
      expect(ok1.pergolaIndex).toBe(1);
      expect(ok0.value.house.model?.wallSegments.length ?? 0).toBeGreaterThan(0);
      expect(ok1.value.house.model?.wallSegments.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('rejects a per-pergola houseContext whose position diverges from the shared rawHouse', () => {
    // Phase-3 sanity check (retired in phase 4): if the per-pergola
    // houseContext.position contradicts the shared rawHouse.position,
    // the orchestrator returns a `house_context_mismatch` error rather
    // than silently using one and ignoring the other.
    const rawHouse: RawHouseInput = {
      ...makeRawHouseInput(),
      position: { origin: { x: 1000, y: 500 }, rotationDeg: 0 },
    };
    const rawPergola: RawGeometryModuleInput = {
      ...makeRawPergolaInput(),
      houseContext: {
        ...makeRawPergolaInput().houseContext,
        position: { origin: { x: 9999, y: 0 }, rotationDeg: 0 },
      },
    };

    const project = solveProject({ rawHouse, rawPergolas: [rawPergola] });
    expect(project.pergolas).toHaveLength(1);
    const result = project.pergolas[0];
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.code).toBe('house_context_mismatch');
    }
  });

  it('preserves the input rawHouse on the result for downstream consumers', () => {
    const rawHouse = makeRawHouseInput();
    const project = solveProject({ rawHouse, rawPergolas: [makeRawPergolaInput()] });
    expect(project.rawHouse).toBe(rawHouse);
  });

  it('returns the pergolaIndex on each result so callers can match results to inputs', () => {
    const rawHouse = makeRawHouseInput();
    const rawPergolas = [
      makeRawPergolaInput({ pergolaId: 'a' }),
      makeRawPergolaInput({ pergolaId: 'b' }),
      makeRawPergolaInput({ pergolaId: 'c' }),
    ];
    const project = solveProject({ rawHouse, rawPergolas });
    expect(project.pergolas.map((p) => p.pergolaIndex)).toEqual([0, 1, 2]);
  });
});
