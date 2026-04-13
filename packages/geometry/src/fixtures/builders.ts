import type { GeometryConfig } from '../contracts';
import { parseAssemblyMemberProfile } from '../profiles';

type GeometryConfigOverrides = Omit<
  Partial<GeometryConfig>,
  'datum' | 'dimensions' | 'roof' | 'roofCovering' | 'gable' | 'box' | 'connection' | 'supports' | 'structural' | 'houseContext'
> & {
  datum?: Partial<GeometryConfig['datum']>;
  dimensions?: Partial<GeometryConfig['dimensions']>;
  roof?: Partial<GeometryConfig['roof']>;
  roofCovering?: Partial<GeometryConfig['roofCovering']>;
  gable?: Partial<GeometryConfig['gable']>;
  box?: Partial<GeometryConfig['box']>;
  connection?: Partial<GeometryConfig['connection']>;
  supports?: Partial<GeometryConfig['supports']>;
  structural?: {
    heights?: Partial<GeometryConfig['structural']['heights']>;
    profiles?: Partial<GeometryConfig['structural']['profiles']>;
    framing?: Partial<GeometryConfig['structural']['framing']>;
    drainage?: Partial<GeometryConfig['structural']['drainage']>;
  };
  houseContext?: Partial<GeometryConfig['houseContext']>;
};

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

export function makeMonoConfig(overrides: GeometryConfigOverrides = {}): GeometryConfig {
  const spGutterProfile = parseAssemblyMemberProfile('SP Gutter');
  if (!spGutterProfile) {
    throw new Error('Expected SP Gutter profile definition.');
  }
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
        gutter: spGutterProfile,
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

export function makeGableConfig(overrides: GeometryConfigOverrides = {}): GeometryConfig {
  const spGutterProfile = parseAssemblyMemberProfile('SP Gutter');
  if (!spGutterProfile) {
    throw new Error('Expected SP Gutter profile definition.');
  }
  const base = makeMonoConfig({
    projectId: 'proj_gable',
    estimateId: 'est_gable',
    designRequestId: 'dpr_gable',
    family: 'gable',
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
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
        gutter: spGutterProfile,
        ridge: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        tieBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        strut: { shape: 'rectangular', widthMm: 50, depthMm: 50 },
        boxPerimeter: null,
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

export function makeBoxConfig(overrides: GeometryConfigOverrides = {}): GeometryConfig {
  const base = makeMonoConfig({
    projectId: 'proj_box',
    estimateId: 'est_box',
    designRequestId: 'dpr_box',
    family: 'box',
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
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
