import type { GeometryConfig } from '../contracts';

export function makeMonoConfig(overrides: Partial<GeometryConfig> = {}): GeometryConfig {
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

  return {
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
}

export function makeGableConfig(overrides: Partial<GeometryConfig> = {}): GeometryConfig {
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

export function makeBoxConfig(overrides: Partial<GeometryConfig> = {}): GeometryConfig {
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
