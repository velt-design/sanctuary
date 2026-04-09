import { describe, expect, it } from 'vitest';
import { solveAssembly3D, type GeometryConfig } from '@sp/geometry';

function buildMonoRoofCovering(
  input: {
    dimensions: GeometryConfig['dimensions'];
    roof: GeometryConfig['roof'];
    connection: GeometryConfig['connection'];
    structural: GeometryConfig['structural'];
  },
  overrides: Partial<GeometryConfig['roofCovering']> = {},
): GeometryConfig['roofCovering'] {
  const referenceProfile =
    input.connection.type === 'freestanding'
      ? (input.structural.profiles.supportBeam ?? input.structural.profiles.ledger)
      : (input.structural.profiles.ledger ?? input.structural.profiles.supportBeam);
  const supportBeamProfile = input.structural.profiles.supportBeam;
  const gutterProfile = input.structural.profiles.gutter;
  const supportBeamWidthMm = supportBeamProfile?.widthMm ?? 50;
  const referenceWidthMm = referenceProfile?.widthMm ?? 50;
  const gutterWidthMm = gutterProfile?.widthMm ?? 100;
  const referenceDepthMm = referenceProfile?.depthMm ?? 100;
  const gutterDepthMm = gutterProfile?.depthMm ?? 150;
  const houseAllowanceMm =
    overrides.houseAllowanceMm ??
    (input.roof.fallDirection === 'negativeY' ? gutterWidthMm : referenceWidthMm);
  const farAllowanceMm =
    overrides.farAllowanceMm ??
    (input.roof.fallDirection === 'negativeY'
      ? supportBeamWidthMm
      : input.structural.drainage.integratedGutterBeam
        ? gutterWidthMm
        : input.structural.drainage.gutterAssemblyMode === 'separate'
          ? supportBeamWidthMm + gutterWidthMm
          : supportBeamWidthMm);
  const houseUndersideMm = input.structural.heights.referenceUndersideMm ?? input.structural.heights.houseUndersideMm ?? 2400;
  const outerUndersideMm = input.structural.heights.outerUndersideMm ?? 2137;
  const startBearingY = referenceWidthMm;
  const endBearingY = Math.max(input.dimensions.projectionMm - gutterWidthMm, startBearingY);
  const houseTopMm = houseUndersideMm + referenceDepthMm;
  const outerTopMm = outerUndersideMm + gutterDepthMm;
  const fallRunMm = endBearingY - startBearingY;
  const fallRiseMm = outerTopMm - houseTopMm;
  const fallLengthMm = Math.sqrt(fallRunMm * fallRunMm + fallRiseMm * fallRiseMm);
  const fallDirectionSign = input.roof.fallDirection === 'negativeY' ? -1 : 1;
  const normalizedFallY = fallLengthMm > 0 ? (fallDirectionSign * fallRunMm) / fallLengthMm : 0;
  const normalizedFallZ = fallLengthMm > 0 ? ((input.roof.fallDirection === 'negativeY' ? houseTopMm - outerTopMm : outerTopMm - houseTopMm) / fallLengthMm) : 0;
  const coverHouseY = startBearingY - normalizedFallY * houseAllowanceMm;
  const coverHouseZ = houseTopMm - normalizedFallZ * houseAllowanceMm;
  const coverFarY = endBearingY + normalizedFallY * farAllowanceMm;
  const coverFarZ = outerTopMm + normalizedFallZ * farAllowanceMm;
  const effectiveRunMm = overrides.effectiveRunMm ?? Math.max(input.dimensions.projectionMm - houseAllowanceMm - farAllowanceMm, 0);
  const panelDownslopeMm = Math.round(Math.sqrt((coverFarY - coverHouseY) ** 2 + (coverFarZ - coverHouseZ) ** 2));
  const structuralDownslopeMm = Math.round(Math.sqrt((endBearingY - startBearingY) ** 2 + (outerTopMm - houseTopMm) ** 2));
  const joinerRunsTotal = overrides.joinerRunsTotal ?? input.structural.framing.rafterCount ?? 11;
  const acrylicRequiredDownslopeMm = overrides.acrylicRequiredDownslopeMm ?? structuralDownslopeMm + 20;
  return {
    kind: 'acrylic',
    effectiveRunMm,
    acrylicRequiredDownslopeMm,
    joinerPieceLengthMm: overrides.joinerPieceLengthMm ?? acrylicRequiredDownslopeMm,
    joinerRunsTotal,
    houseAllowanceMm,
    farAllowanceMm,
    acrylicAreaMm2: overrides.acrylicAreaMm2 ?? input.dimensions.lengthMm * panelDownslopeMm,
  };
}

function makeMonoConfig(overrides: Partial<GeometryConfig> = {}): GeometryConfig {
  const base: GeometryConfig = {
    projectId: 'proj_mono',
    estimateId: 'est_mono',
    designRequestId: 'dpr_mono',
    family: 'mono',
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: 6000, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 6000,
      projectionMm: 3000,
      roofPitchDeg: 5,
    },
    roof: {
      material: 'acrylic',
      mode: null,
      fallDirection: 'positiveY',
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    roofCovering: {
      kind: 'acrylic',
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    box: {
      houseEdgeGutterMode: null,
      farEdgeGutterMode: null,
      houseSetbackMm: null,
      outerSetbackMm: null,
      effectiveRunMm: null,
      riseMm: null,
      maxFallMm: null,
    },
    connection: {
      type: 'soffit',
      attachmentSide: 'rear',
    },
    supports: {
      postMode: 'standard',
      postCount: 2,
      postPositions: undefined,
      postCutHeightMm: 2400,
      footingType: 'slab',
      postConnectionType: 'slab_anchors',
      groundCondition: 'easy',
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: 2400,
        outerUndersideMm: 2137,
        referenceUndersideMm: 2400,
      },
      profiles: {
        post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
        rafter: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
        supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        gutter: { shape: 'rectangular', widthMm: 100, depthMm: 150 },
        ridge: null,
        boxPerimeter: null,
      },
      framing: {
        rafterCount: 11,
        rafterSpacingMm: 600,
      },
      drainage: {
        gutterType: 'sp_gutter',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint: null,
    },
  };

  const mergedBase = {
    ...base,
    ...overrides,
    datum: { ...base.datum, ...overrides.datum },
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    gable: { ...base.gable, ...overrides.gable },
    box: { ...base.box, ...overrides.box },
    connection: { ...base.connection, ...overrides.connection },
    supports: { ...base.supports, ...overrides.supports },
    structural: {
      heights: { ...base.structural.heights, ...overrides.structural?.heights },
      profiles: { ...base.structural.profiles, ...overrides.structural?.profiles },
      framing: { ...base.structural.framing, ...overrides.structural?.framing },
      drainage: { ...base.structural.drainage, ...overrides.structural?.drainage },
    },
    houseContext: { ...base.houseContext, ...overrides.houseContext },
  };

  return {
    ...mergedBase,
    roofCovering:
      mergedBase.roof.material === 'acrylic'
        ? {
            ...buildMonoRoofCovering(
              {
                dimensions: mergedBase.dimensions,
                roof: mergedBase.roof,
                connection: mergedBase.connection,
                structural: mergedBase.structural,
              },
              overrides.roofCovering,
            ),
            ...overrides.roofCovering,
          }
        : { ...base.roofCovering, ...overrides.roofCovering },
  };
}

function makeGableConfig(overrides: Partial<GeometryConfig> = {}): GeometryConfig {
  const base = makeMonoConfig({
    projectId: 'proj_gable',
    estimateId: 'est_gable',
    designRequestId: 'dpr_gable',
    family: 'gable',
    datum: {
      attachmentEdgeEnd: { x: 6500, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 6500,
      projectionMm: 4000,
      roofPitchDeg: 25,
    },
    roof: {
      material: 'timber',
      mode: 'symmetrical',
      fallDirection: 'dual',
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    roofCovering: {
      kind: null,
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: 2000,
      endFramesMode: 'none',
      houseEaveGutterMode: 'house',
      outerEaveGutterMode: 'our',
    },
    connection: {
      type: 'soffit',
      attachmentSide: 'rear',
    },
    supports: {
      postMode: 'standard',
      postCount: 3,
      postPositions: undefined,
      postCutHeightMm: 2700,
      footingType: 'slab',
      postConnectionType: 'slab_anchors',
      groundCondition: 'easy',
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: 2700,
        outerUndersideMm: 2700,
        referenceUndersideMm: 2700,
      },
      profiles: {
        post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
        rafter: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
        supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        gutter: { shape: 'rectangular', widthMm: 100, depthMm: 150 },
        ridge: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
      },
      framing: {
        rafterCount: 12,
        rafterSpacingMm: 590,
      },
      drainage: {
        gutterType: 'sp_gutter',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint: null,
    },
  });

  return {
    ...base,
    ...overrides,
    datum: { ...base.datum, ...overrides.datum },
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    roofCovering: { ...base.roofCovering, ...overrides.roofCovering },
    gable: { ...base.gable, ...overrides.gable },
    box: { ...base.box, ...overrides.box },
    connection: { ...base.connection, ...overrides.connection },
    supports: { ...base.supports, ...overrides.supports },
    structural: {
      heights: { ...base.structural.heights, ...overrides.structural?.heights },
      profiles: { ...base.structural.profiles, ...overrides.structural?.profiles },
      framing: { ...base.structural.framing, ...overrides.structural?.framing },
      drainage: { ...base.structural.drainage, ...overrides.structural?.drainage },
    },
    houseContext: { ...base.houseContext, ...overrides.houseContext },
  };
}

function makeBoxConfig(overrides: Partial<GeometryConfig> = {}): GeometryConfig {
  const base = makeMonoConfig({
    projectId: 'proj_box',
    estimateId: 'est_box',
    designRequestId: 'dpr_box',
    family: 'box',
    datum: {
      attachmentEdgeEnd: { x: 5500, y: 0, z: 0 },
    },
    dimensions: {
      lengthMm: 5500,
      projectionMm: 3500,
      roofPitchDeg: 3,
    },
    roof: {
      material: 'timber',
      mode: 'box_perimeter',
      fallDirection: 'positiveY',
      boxPerimeterEnabled: true,
      overhangMm: 0,
    },
    roofCovering: {
      kind: null,
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    box: {
      houseEdgeGutterMode: 'house',
      farEdgeGutterMode: 'our',
      houseSetbackMm: 150,
      outerSetbackMm: 50,
      effectiveRunMm: 3300,
      riseMm: 173,
      maxFallMm: 200,
    },
    connection: {
      type: 'soffit',
      attachmentSide: 'rear',
    },
    supports: {
      postMode: 'standard',
      postCount: 3,
      postPositions: undefined,
      postCutHeightMm: 2500,
      footingType: 'slab',
      postConnectionType: 'slab_anchors',
      groundCondition: 'easy',
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: 2500,
        outerUndersideMm: 2500,
        referenceUndersideMm: 2500,
      },
      profiles: {
        post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
        rafter: { shape: 'rectangular', widthMm: 50, depthMm: 80 },
        ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
        supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        gutter: { shape: 'rectangular', widthMm: 100, depthMm: 100 },
        ridge: null,
        boxPerimeter: { shape: 'rectangular', widthMm: 50, depthMm: 300 },
      },
      framing: {
        rafterCount: 10,
        rafterSpacingMm: 550,
      },
      drainage: {
        gutterType: 'box_gutter_100x100x3',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint: null,
    },
  });

  return {
    ...base,
    ...overrides,
    datum: { ...base.datum, ...overrides.datum },
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    roofCovering: { ...base.roofCovering, ...overrides.roofCovering },
    gable: { ...base.gable, ...overrides.gable },
    box: { ...base.box, ...overrides.box },
    connection: { ...base.connection, ...overrides.connection },
    supports: { ...base.supports, ...overrides.supports },
    structural: {
      heights: { ...base.structural.heights, ...overrides.structural?.heights },
      profiles: { ...base.structural.profiles, ...overrides.structural?.profiles },
      framing: { ...base.structural.framing, ...overrides.structural?.framing },
      drainage: { ...base.structural.drainage, ...overrides.structural?.drainage },
    },
    houseContext: { ...base.houseContext, ...overrides.houseContext },
  };
}

describe('solveAssembly3D', () => {
  it('builds a complete attached mono assembly', () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2400 },
      end: { x: 6000, y: 0, z: 2400 },
    });
    expect(result.value.members.map((member) => member.role)).toEqual(
      expect.arrayContaining(['ledger', 'beam', 'gutter', 'post', 'rafter']),
    );
    expect(result.value.members.filter((member) => member.role === 'post')).toHaveLength(2);
    expect(result.value.roofPlanes).toHaveLength(1);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: 'posts.count', quantity: 2, unit: 'count' },
        { key: 'support_beam.length_mm', quantity: 6000, unit: 'mm' },
        { key: 'ledger.length_mm', quantity: 6000, unit: 'mm' },
      ]),
    );
  });

  it('builds a freestanding mono assembly with no ledger or attachment edge', () => {
    const result = solveAssembly3D(
      makeMonoConfig({
        connection: {
          type: 'freestanding',
          attachmentSide: 'rear',
        },
        supports: {
          postCount: 4,
        },
        structural: {
          heights: {
            houseUndersideMm: 2400,
            outerUndersideMm: 2137,
            referenceUndersideMm: 2400,
          },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toBeNull();
    expect(result.value.members.some((member) => member.role === 'ledger')).toBe(false);
    expect(result.value.members.filter((member) => member.role === 'beam')).toHaveLength(2);
    expect(result.value.members.filter((member) => member.role === 'post')).toHaveLength(4);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: 'posts.count', quantity: 4, unit: 'count' },
        { key: 'support_beam.length_mm', quantity: 12000, unit: 'mm' },
      ]),
    );
  });

  it('produces opposite fall vectors for away-from-house and toward-house mono', () => {
    const away = solveAssembly3D(makeMonoConfig());
    const toward = solveAssembly3D(
      makeMonoConfig({
        roof: {
          fallDirection: 'negativeY',
        },
        structural: {
          heights: {
            houseUndersideMm: 2137,
            outerUndersideMm: 2400,
            referenceUndersideMm: 2137,
          },
        },
      }),
    );

    expect(away.ok).toBe(true);
    expect(toward.ok).toBe(true);
    if (!away.ok || !toward.ok) return;

    expect(away.value.roofPlanes[0]?.fallVector.y).toBeGreaterThan(0);
    expect(away.value.roofPlanes[0]?.fallVector.z).toBeLessThan(0);
    expect(toward.value.roofPlanes[0]?.fallVector.y).toBeLessThan(0);
    expect(toward.value.roofPlanes[0]?.fallVector.z).toBeLessThan(0);
  });

  it('places member centerlines and roof plane heights from underside and profile inputs', () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ledger = result.value.members.find((member) => member.id === 'ledger');
    const outerBeam = result.value.members.find((member) => member.id === 'outer-beam');
    const roofPlane = result.value.roofPlanes[0];

    expect(ledger?.centerline.start.z).toBe(2450);
    expect(outerBeam?.centerline.start.z).toBe(2212);
    expect(roofPlane?.boundary[0]?.z).toBe(2500);
    expect(roofPlane?.boundary[2]?.z).toBe(2287);
  });

  it('keeps mono rafters on edge and horizontal members with vertical depth axes', () => {
    const result = solveAssembly3D(makeMonoConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rafter = result.value.members.find((member) => member.id === 'rafter-1');
    const ledger = result.value.members.find((member) => member.id === 'ledger');
    const outerBeam = result.value.members.find((member) => member.id === 'outer-beam');
    const joiner = result.value.members.find((member) => member.id === 'joiner-1');

    expect(rafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(rafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.y).toBeCloseTo(0.074529, 6);
    expect(rafter?.localFrame.zAxis.z).toBeCloseTo(0.997219, 6);

    expect(ledger?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(ledger?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(outerBeam?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(outerBeam?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(joiner?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(joiner?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(joiner?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(joiner?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(joiner?.localFrame.zAxis.y).toBeCloseTo(0.074529, 6);
    expect(joiner?.localFrame.zAxis.z).toBeCloseTo(0.997219, 6);
  });

  it('keeps post layout deterministic for 2, 3, and 4 attached posts', () => {
    const twoPosts = solveAssembly3D(makeMonoConfig({ supports: { postCount: 2 } }));
    const threePosts = solveAssembly3D(makeMonoConfig({ supports: { postCount: 3 } }));
    const fourPosts = solveAssembly3D(makeMonoConfig({ supports: { postCount: 4 } }));

    expect(twoPosts.ok).toBe(true);
    expect(threePosts.ok).toBe(true);
    expect(fourPosts.ok).toBe(true);
    if (!twoPosts.ok || !threePosts.ok || !fourPosts.ok) return;

    expect(twoPosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 6000]);
    expect(threePosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 3000, 6000]);
    expect(fourPosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 2000, 4000, 6000]);
  });

  it('builds a complete attached gable assembly', () => {
    const result = solveAssembly3D(makeGableConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2700 },
      end: { x: 6500, y: 0, z: 2700 },
    });
    expect(result.value.roofPlanes).toHaveLength(2);
    expect(result.value.members.filter((member) => member.role === 'ridge')).toHaveLength(1);
    expect(result.value.members.filter((member) => member.role === 'post')).toHaveLength(3);
    expect(result.value.members.filter((member) => member.role === 'rafter')).toHaveLength(24);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: 'ridge.length_mm', quantity: 6500, unit: 'mm' },
        { key: 'house_eave_support.length_mm', quantity: 6500, unit: 'mm' },
        { key: 'outer_eave_support.length_mm', quantity: 6500, unit: 'mm' },
        { key: 'outer_gutter.length_mm', quantity: 6500, unit: 'mm' },
      ]),
    );
  });

  it('builds a complete freestanding gable assembly', () => {
    const result = solveAssembly3D(
      makeGableConfig({
        connection: {
          type: 'freestanding',
          attachmentSide: 'rear',
        },
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: 'none',
          houseEaveGutterMode: 'our',
          outerEaveGutterMode: 'our',
        },
        supports: {
          postCount: 4,
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toBeNull();
    expect(result.value.members.some((member) => member.id === 'ledger')).toBe(false);
    expect(result.value.members.filter((member) => member.role === 'beam')).toHaveLength(2);
    expect(result.value.members.filter((member) => member.role === 'gutter')).toHaveLength(2);
    expect(result.value.members.filter((member) => member.role === 'post')).toHaveLength(4);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: 'house_gutter.length_mm', quantity: 6500, unit: 'mm' },
        { key: 'posts.count', quantity: 4, unit: 'count' },
      ]),
    );
  });

  it('derives gable ridge height and opposing fall directions from pitch and half-span geometry', () => {
    const result = solveAssembly3D(makeGableConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ridge = result.value.members.find((member) => member.id === 'ridge');
    expect(ridge?.centerline.start.y).toBe(2000);
    expect(Math.round(ridge?.centerline.start.z ?? 0)).toBe(3708);
    expect(result.value.roofPlanes[0]?.fallVector.y).toBeLessThan(0);
    expect(result.value.roofPlanes[1]?.fallVector.y).toBeGreaterThan(0);
  });

  it('keeps gable rafters on edge and eave members with vertical depth axes', () => {
    const result = solveAssembly3D(makeGableConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const houseRafter = result.value.members.find((member) => member.id === 'house-rafter-1');
    const outerRafter = result.value.members.find((member) => member.id === 'outer-rafter-1');
    const ridge = result.value.members.find((member) => member.id === 'ridge');
    const outerGutter = result.value.members.find((member) => member.id === 'outer-gutter');

    expect(houseRafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(houseRafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(houseRafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(houseRafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(houseRafter?.localFrame.zAxis.y).toBeCloseTo(-0.431458, 6);
    expect(houseRafter?.localFrame.zAxis.z).toBeCloseTo(0.902133, 6);

    expect(outerRafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(outerRafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(outerRafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(outerRafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(outerRafter?.localFrame.zAxis.y).toBeCloseTo(0.440631, 6);
    expect(outerRafter?.localFrame.zAxis.z).toBeCloseTo(0.897689, 6);

    expect(ridge?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(ridge?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(outerGutter?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(outerGutter?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });
  });

  it('keeps gable post layout deterministic for 2, 3, and 4 standard support positions', () => {
    const twoPosts = solveAssembly3D(makeGableConfig({ supports: { postCount: 2 } }));
    const threePosts = solveAssembly3D(makeGableConfig({ supports: { postCount: 3 } }));
    const fourPosts = solveAssembly3D(
      makeGableConfig({
        connection: {
          type: 'freestanding',
          attachmentSide: 'rear',
        },
        gable: {
          ridgePositionMm: 2000,
          endFramesMode: 'none',
          houseEaveGutterMode: 'our',
          outerEaveGutterMode: 'our',
        },
        supports: {
          postCount: 4,
        },
      }),
    );

    expect(twoPosts.ok).toBe(true);
    expect(threePosts.ok).toBe(true);
    expect(fourPosts.ok).toBe(true);
    if (!twoPosts.ok || !threePosts.ok || !fourPosts.ok) return;

    expect(twoPosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 6500]);
    expect(threePosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 3250, 6500]);
    expect(fourPosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 6500, 0, 6500]);
  });

  it('builds a complete attached standard box assembly', () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.attachmentEdge).toEqual({
      start: { x: 0, y: 0, z: 2500 },
      end: { x: 5500, y: 0, z: 2500 },
    });
    expect(result.value.roofPlanes).toHaveLength(1);
    expect(result.value.members.find((member) => member.id === 'ledger')?.role).toBe('ledger');
    expect(result.value.members.find((member) => member.id === 'outer-gutter')?.role).toBe('gutter');
    expect(result.value.members.find((member) => member.id === 'outer-box-beam')?.role).toBe('beam');
    expect(result.value.members.find((member) => member.id === 'left-box-beam')?.role).toBe('beam');
    expect(result.value.members.find((member) => member.id === 'right-box-beam')?.role).toBe('beam');
    expect(result.value.members.filter((member) => member.role === 'post')).toHaveLength(3);
    expect(result.value.members.filter((member) => member.role === 'rafter')).toHaveLength(10);
    expect(result.value.quantityHooks).toEqual(
      expect.arrayContaining([
        { key: 'ledger.length_mm', quantity: 5500, unit: 'mm' },
        { key: 'outer_gutter.length_mm', quantity: 5500, unit: 'mm' },
        { key: 'roof_planes.count', quantity: 1, unit: 'count' },
      ]),
    );
  });

  it('keeps the box roof field inset to the standard house and far setbacks', () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const roofPlane = result.value.roofPlanes[0];
    expect(roofPlane?.boundary[0]?.y).toBe(150);
    expect(roofPlane?.boundary[2]?.y).toBe(3450);
  });

  it('matches the box roof fall to the derived rise and effective run', () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const roofPlane = result.value.roofPlanes[0];
    expect(roofPlane?.fallVector.y).toBeGreaterThan(0);
    expect(roofPlane?.fallVector.z).toBeLessThan(0);
    expect(Math.round((roofPlane?.boundary[0]?.z ?? 0) - (roofPlane?.boundary[2]?.z ?? 0))).toBe(173);
  });

  it('keeps box rafters on edge and perimeter members with vertical depth axes', () => {
    const result = solveAssembly3D(makeBoxConfig());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rafter = result.value.members.find((member) => member.id === 'box-rafter-1');
    const ledger = result.value.members.find((member) => member.id === 'ledger');
    const sideBeam = result.value.members.find((member) => member.id === 'left-box-beam');
    const outerBeam = result.value.members.find((member) => member.id === 'outer-box-beam');

    expect(rafter?.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(rafter?.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(rafter?.localFrame.zAxis.y).toBeCloseTo(0.052352, 6);
    expect(rafter?.localFrame.zAxis.z).toBeCloseTo(0.998629, 6);

    expect(ledger?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(ledger?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });

    expect(sideBeam?.localFrame.yAxis).toEqual({
      x: -1,
      y: 0,
      z: 0,
    });
    expect(sideBeam?.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(sideBeam?.localFrame.zAxis.y).toBeCloseTo(0.052352, 6);
    expect(sideBeam?.localFrame.zAxis.z).toBeCloseTo(0.998629, 6);

    expect(outerBeam?.localFrame.yAxis).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
    expect(outerBeam?.localFrame.zAxis).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });
  });

  it('keeps box post layout deterministic for 2, 3, and 4 standard support positions', () => {
    const twoPosts = solveAssembly3D(makeBoxConfig({ supports: { postCount: 2 } }));
    const threePosts = solveAssembly3D(makeBoxConfig({ supports: { postCount: 3 } }));
    const fourPosts = solveAssembly3D(makeBoxConfig({ supports: { postCount: 4 } }));

    expect(twoPosts.ok).toBe(true);
    expect(threePosts.ok).toBe(true);
    expect(fourPosts.ok).toBe(true);
    if (!twoPosts.ok || !threePosts.ok || !fourPosts.ok) return;

    expect(twoPosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 5500]);
    expect(threePosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 2750, 5500]);
    expect(fourPosts.value.members.filter((member) => member.role === 'post').map((member) => member.centerline.start.x)).toEqual([0, 1833, 3667, 5500]);
  });

  it('rejects unsupported mono variants', () => {
    expect(solveAssembly3D(makeMonoConfig({ roof: { overhangMm: 250 } }))).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Mono solver does not yet support overhang geometry.',
    });
    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            drainage: {
              gutterAssemblyMode: 'separate',
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Mono solver does not yet support separate-gutter mono variants.',
    });
    expect(
      solveAssembly3D(
        makeMonoConfig({
          supports: {
            postMode: 'custom',
            postPositions: [
              { x: 1000, y: 3000, z: 0 },
              { x: 5000, y: 3000, z: 0 },
            ],
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Mono solver only supports the standard post layout.',
    });
  });

  it('rejects unsupported gable variants', () => {
    expect(
      solveAssembly3D(
        makeGableConfig({
          gable: {
            ridgePositionMm: 2000,
            endFramesMode: 'outer_end_only',
            houseEaveGutterMode: 'house',
            outerEaveGutterMode: 'our',
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Gable solver does not yet support gable end frames.',
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          gable: {
            ridgePositionMm: 2000,
            endFramesMode: 'none',
            houseEaveGutterMode: 'our',
            outerEaveGutterMode: 'our',
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Gable solver only supports the standard baseline eave gutter configuration.',
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          roof: {
            overhangMm: 200,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Gable solver does not yet support overhang geometry.',
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          structural: {
            drainage: {
              gutterAssemblyMode: 'separate',
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Gable solver does not yet support separate-gutter gable variants.',
    });
  });

  it('rejects unsupported box variants', () => {
    expect(
      solveAssembly3D(
        makeBoxConfig({
          connection: {
            type: 'freestanding',
            attachmentSide: 'rear',
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Box solver currently supports attached box-perimeter layouts only.',
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          box: {
            houseEdgeGutterMode: 'our',
            farEdgeGutterMode: 'our',
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Box solver only supports the standard baseline box gutter configuration.',
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          roof: {
            overhangMm: 150,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Box solver does not yet support overhang geometry.',
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          structural: {
            drainage: {
              gutterAssemblyMode: 'separate',
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Box solver does not yet support separate-gutter box variants.',
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          supports: {
            postMode: 'custom',
            postPositions: [
              { x: 1000, y: 3500, z: 0 },
              { x: 4500, y: 3500, z: 0 },
            ],
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Box solver only supports the standard post layout.',
    });
  });

  it('rejects insufficient structural input', () => {
    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            heights: {
              houseUndersideMm: 2400,
              outerUndersideMm: null,
              referenceUndersideMm: 2400,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'insufficient_input',
      error: 'Mono solver requires an outer underside height.',
    });

    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            profiles: {
              post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
              rafter: null,
              ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
              supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
              gutter: { shape: 'rectangular', widthMm: 100, depthMm: 150 },
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'insufficient_input',
      error: 'Mono solver requires the rafter profile.',
    });

    expect(
      solveAssembly3D(
        makeMonoConfig({
          structural: {
            framing: {
              rafterCount: null,
              rafterSpacingMm: 600,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'insufficient_input',
      error: 'Mono solver requires a rafter count.',
    });
  });

  it('rejects insufficient gable structural input', () => {
    expect(
      solveAssembly3D(
        makeGableConfig({
          structural: {
            profiles: {
              post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
              rafter: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
              ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
              supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
              gutter: { shape: 'rectangular', widthMm: 100, depthMm: 150 },
              ridge: null,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'insufficient_input',
      error: 'Gable solver requires the ridge profile.',
    });

    expect(
      solveAssembly3D(
        makeGableConfig({
          structural: {
            framing: {
              rafterCount: null,
              rafterSpacingMm: 590,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'insufficient_input',
      error: 'Gable solver requires a rafter count.',
    });
  });

  it('rejects insufficient box structural input', () => {
    expect(
      solveAssembly3D(
        makeBoxConfig({
          structural: {
            profiles: {
              post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
              rafter: { shape: 'rectangular', widthMm: 50, depthMm: 80 },
              ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
              supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
              gutter: { shape: 'rectangular', widthMm: 100, depthMm: 100 },
              ridge: null,
              boxPerimeter: null,
            },
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'insufficient_input',
      error: 'Box solver requires the box perimeter beam profile.',
    });

    expect(
      solveAssembly3D(
        makeBoxConfig({
          box: {
            houseEdgeGutterMode: 'house',
            farEdgeGutterMode: 'our',
            houseSetbackMm: 150,
            outerSetbackMm: 50,
            effectiveRunMm: null,
            riseMm: 173,
            maxFallMm: 200,
          },
        }),
      ),
    ).toEqual({
      ok: false,
      code: 'insufficient_input',
      error: 'Box solver requires derived effective run, rise, and max fall inputs.',
    });
  });
});
