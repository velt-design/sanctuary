import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as geometryModule from '@sp/geometry';
import * as legacyGeometryModule from '@sp/geometry/legacy';
import type { Assembly3D, GeometryConfig, ViewerSceneModel } from '@sp/geometry';
import type { LegacyAssemblyModel, LegacyGeometryConfig } from '@sp/geometry/legacy';

const monoConfig: GeometryConfig = {
  projectId: 'proj_mono',
  estimateId: 'est_mono',
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
    fallDirection: 'positiveY',
    boxPerimeterEnabled: false,
    overhangMm: 0,
  },
  roofCovering: {
    kind: 'acrylic',
    effectiveRunMm: 2850,
    acrylicRequiredDownslopeMm: 2908,
    joinerPieceLengthMm: 2908,
    joinerRunsTotal: 11,
    houseAllowanceMm: 25,
    farAllowanceMm: 25,
    acrylicAreaMm2: 17448000,
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
    postCutHeightMm: 2400,
    footingType: 'slab',
    postConnectionType: 'slab_anchors',
    groundCondition: 'easy',
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
    soffitDepthMm: 450,
    footprint: [
      { x: 0, y: -1800, z: 0 },
      { x: 6000, y: -1800, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ],
  },
};

const gableConfig: GeometryConfig = {
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
    type: 'wall',
    attachmentSide: 'rear',
  },
  supports: {
    postMode: 'custom',
    postPositions: [
      { x: 0, y: 4000, z: 0 },
      { x: 6500, y: 4000, z: 0 },
    ],
    postCount: 2,
    postCutHeightMm: 2700,
    footingType: 'pier',
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
    wallLine: {
      start: { x: 0, y: 0, z: 0 },
      end: { x: 6500, y: 0, z: 0 },
    },
  },
};

const boxConfig: GeometryConfig = {
  projectId: 'proj_box',
  estimateId: 'est_box',
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
    type: 'fascia',
    attachmentSide: 'rear',
  },
  supports: {
    postMode: 'standard',
    postCount: 2,
    postCutHeightMm: 2500,
    footingType: 'pile',
    postConnectionType: 'pile_1m',
    groundCondition: 'hard',
  },
  structural: {
    heights: {
      houseUndersideMm: 2500,
      outerUndersideMm: 2380,
      referenceUndersideMm: 2500,
    },
    profiles: {
      post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
      rafter: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
      ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
      supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
      gutter: { shape: 'rectangular', widthMm: 100, depthMm: 100 },
      ridge: null,
      boxPerimeter: { shape: 'rectangular', widthMm: 50, depthMm: 300 },
    },
    framing: {
      rafterCount: 10,
      rafterSpacingMm: 610,
    },
    drainage: {
      gutterType: 'box_gutter_100x100x3',
      gutterAssemblyMode: 'integrated',
      integratedGutterBeam: true,
      hasOurGutter: true,
    },
  },
  houseContext: {
    fasciaLine: {
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5500, y: 0, z: 0 },
    },
  },
};

const monoAssembly: Assembly3D = {
  family: 'mono',
  datum: monoConfig.datum,
  outline: [
    { x: 0, y: 0, z: 0 },
    { x: 6000, y: 0, z: 0 },
    { x: 6000, y: 3000, z: 0 },
    { x: 0, y: 3000, z: 0 },
  ],
  attachmentEdge: {
    start: { x: 0, y: 0, z: 2800 },
    end: { x: 6000, y: 0, z: 2800 },
  },
  house: {
    wallPlane: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: -1, z: 0 },
    },
    soffitDepthMm: 450,
  },
  members: [
    {
      id: 'post-1',
      role: 'post',
      centerline: {
        start: { x: 0, y: 3000, z: 0 },
        end: { x: 0, y: 3000, z: 2400 },
      },
      profile: {
        shape: 'rectangular',
        widthMm: 90,
        depthMm: 90,
      },
      localFrame: {
        origin: { x: 0, y: 3000, z: 0 },
        xAxis: { x: 0, y: 0, z: 1 },
        yAxis: { x: 1, y: 0, z: 0 },
        zAxis: { x: 0, y: 1, z: 0 },
      },
    },
    {
      id: 'ledger',
      role: 'ledger',
      centerline: {
        start: { x: 0, y: 0, z: 2800 },
        end: { x: 6000, y: 0, z: 2800 },
      },
      profile: {
        shape: 'rectangular',
        widthMm: 150,
        depthMm: 50,
      },
      localFrame: {
        origin: { x: 0, y: 0, z: 2800 },
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 0, z: 1 },
        zAxis: { x: 0, y: 1, z: 0 },
      },
    },
  ],
  roofPlanes: [
    {
      id: 'mono-roof',
      boundary: [
        { x: 0, y: 0, z: 2800 },
        { x: 6000, y: 0, z: 2800 },
        { x: 6000, y: 3000, z: 2537 },
        { x: 0, y: 3000, z: 2537 },
      ],
      plane: {
        origin: { x: 0, y: 0, z: 2800 },
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 3000, z: -263 },
        normal: { x: 0, y: 263, z: 3000 },
      },
      fallVector: { x: 0, y: 1, z: -0.0875 },
    },
  ],
  supportConditions: [
    {
      type: 'house_connection',
      memberId: 'ledger',
      metadata: {
        connectionType: 'soffit',
      },
    },
  ],
  quantityHooks: [
    { key: 'posts', quantity: 2, unit: 'count' },
    { key: 'rafters', quantity: 1, unit: 'count' },
  ],
  semantics: {
    connectionType: 'soffit',
    roofType: 'mono',
    structuralZones: ['roof_field'],
  },
};

const viewerScene: ViewerSceneModel = {
  layers: [
    {
      id: 'beams',
      label: 'Beams',
      visibleByDefault: true,
      objects: monoAssembly.members.map((member) => ({
        id: member.id,
        type: 'member_prism' as const,
        sourceId: member.id,
        role: member.role,
        centerline: member.centerline,
        profile: member.profile,
        localFrame: member.localFrame,
        lengthMm: 6000,
        renderMode: 'prism' as const,
      })),
    },
  ],
};

const legacyConfig: LegacyGeometryConfig = {
  projectId: 'proj_legacy',
  estimateId: 'est_legacy',
  designRequestId: 'dpr_legacy',
  pergolaType: 'mono',
  widthMm: 6000,
  projectionMm: 3000,
  roofPitchDeg: 5,
  roof: {
    material: 'acrylic',
  },
  connection: {
    type: 'soffit',
    attachmentSide: 'rear',
  },
  supports: {
    postMode: 'standard',
  },
  houseContext: {
    soffitDepthMm: 450,
  },
  viewState: {
    activeView: 'plan',
    viewportMode: 'model',
  },
};

const legacyAssembly: LegacyAssemblyModel = {
  outline: [
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 3000 },
    { x: 0, y: 3000 },
  ],
  roofForm: {
    kind: 'mono',
    outline: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    pitchDeg: 5,
    eaveLine: {
      start: { x: 0, y: 3000 },
      end: { x: 6000, y: 3000 },
    },
    fallDirection: { x: 0, y: 1 },
    boxPerimeter: false,
  },
  attachmentEdge: {
    ring: 'outer',
    index: 0,
    id: 'rear',
  },
  houseContext: {
    connectionType: 'soffit',
    attachmentSide: 'rear',
    attachmentEdge: {
      ring: 'outer',
      index: 0,
      id: 'rear',
    },
    soffitDepthMm: 450,
  },
  posts: [],
  beams: [],
  rafters: [],
  gutters: [],
  supports: [],
  fall: {
    direction: { x: 0, y: 1 },
    label: 'FALL',
    source: 'roof_form',
  },
  semantics: {
    connectionType: 'soffit',
    roofType: 'mono',
    structuralZones: [],
    detailFamilies: [],
  },
};

describe('@sp/geometry contracts', () => {
  it('resolves the canonical package export surface from @sp/geometry', () => {
    expect(geometryModule).toBeTypeOf('object');
    expect(typeof geometryModule.normalizeGeometryConfig).toBe('function');
    expect(typeof geometryModule.solveAssembly3D).toBe('function');
    expect(typeof geometryModule.validateGeometrySolve).toBe('function');
    expect(typeof geometryModule.buildViewerSceneModel).toBe('function');
    expect(typeof geometryModule.buildPlanViewModel).toBe('function');
    expect(typeof geometryModule.buildSectionViewModel).toBe('function');
  });

  it('supports mono, gable, and box V1 configs using the new 3D-first geometry contract', () => {
    expect([monoConfig.family, gableConfig.family, boxConfig.family]).toEqual(['mono', 'gable', 'box']);
    expect(gableConfig.supports.postMode).toBe('custom');
    expect(boxConfig.roof.boxPerimeterEnabled).toBe(true);
    expect(monoConfig.datum.attachmentEdgeEnd.z).toBe(0);
    expect(monoConfig.structural.profiles.ledger?.depthMm).toBe(100);
    expect(monoConfig.roof.overhangMm).toBe(0);
  });

  it('expresses the required assembly semantics for future validation and viewer work', () => {
    expect(monoAssembly.house.soffitDepthMm).toBe(450);
    expect(monoAssembly.members.map((member) => member.role)).toContain('ledger');
    expect(monoAssembly.roofPlanes[0]?.fallVector.y).toBe(1);
    expect(monoAssembly.quantityHooks).toContainEqual({ key: 'posts', quantity: 2, unit: 'count' });
    expect(viewerScene.layers[0]?.objects[0]?.type).toBe('member_prism');
  });

  it('keeps the canonical package runtime free of portal and surface concerns', () => {
    const sourceDir = path.resolve(__dirname);
    const sourceFiles = fs
      .readdirSync(sourceDir)
      .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts') && entry !== 'legacy.ts')
      .map((entry) => fs.readFileSync(path.join(sourceDir, entry), 'utf8'))
      .join('\n');

    expect(sourceFiles).not.toContain('apps/portal');
    expect(sourceFiles).not.toContain("from 'react'");
    expect(sourceFiles).not.toContain('ModulePlanModel');
    expect(sourceFiles).not.toContain('ModuleSectionModel');
    expect(sourceFiles).not.toContain('viewState');
    expect(sourceFiles).not.toContain('viewportMode');
  });

  it('preserves the legacy 2D drawing-oriented contracts under the explicit legacy entrypoint', () => {
    expect(legacyGeometryModule).toBeTypeOf('object');
    expect(legacyConfig.viewState.activeView).toBe('plan');
    expect(legacyAssembly.roofForm.kind).toBe('mono');
  });
});
