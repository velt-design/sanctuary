import { describe, expect, it } from 'vitest';
import type { CostOutputV1, RoofType } from '@sp/costing';
import type { Assembly3D, ConnectionType, DatumFrame3, Plane3, Point3 } from '@sp/geometry';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildAssemblyModel } from './buildAssemblyModel';
import type { DrawingAssemblyModel } from './types';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '5',
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: false,
    mixedSkylightStripCount: '0',
    mixedSkylightStripWidthM: '0',
    mixedAcrylicBaysMain: '0',
    mixedAcrylicBaysA: '0',
    mixedAcrylicBaysB: '0',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',
    postCount: '4',
    houseConnectionType: 'soffit',
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
  };
  return { ...base, ...overrides } as CalculatorModuleInputs;
}

function makeResult(params: {
  roofType?: RoofType;
  lengthA?: number;
  spanA?: number;
  slopeDirection?: 'away_from_house' | 'toward_house' | null;
  roofPitchDegUsed?: number;
  heightHouseSideM?: number;
  heightOuterSideM?: number;
}): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: params.roofType ?? 'pitched',
    },
    derived: {
      length_m: params.lengthA ?? 6,
      projection_m: params.spanA ?? 3,
      slope_direction: params.slopeDirection ?? 'away_from_house',
      roof_pitch_deg_used: params.roofPitchDegUsed ?? 5,
      height_house_side_m: params.heightHouseSideM ?? 2.4,
      height_outer_side_m: params.heightOuterSideM ?? 2.1,
    },
  } as unknown as CostOutputV1;
}

function makeSnapshot(module: CalculatorModuleInputs, result: CostOutputV1): Record<string, unknown> {
  return {
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Compatibility Project',
      quoteRef: 'Q-2000',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [module],
    },
    outputs: {
      pergolas: [{ id: 'pergola-1', modules: [result] }],
    },
  } satisfies Record<string, unknown>;
}

function buildCurrentAssembly(module: CalculatorModuleInputs, result: CostOutputV1): DrawingAssemblyModel {
  const drawingModule = buildEstimateDrawingModules(makeSnapshot(module, result))[0]!;
  return buildAssemblyModel({
    id: drawingModule.id,
    label: drawingModule.label,
    moduleIndex: 0,
    moduleInput: drawingModule.input,
    moduleResult: drawingModule.result,
    planModel: drawingModule.planModel,
    sectionModel: drawingModule.sectionModel,
  });
}

function point3(x: number, y: number, z = 0): Point3 {
  return { x, y, z };
}

function rectangle3(lengthMm: number, spanMm: number, z = 0): Point3[] {
  return [point3(0, 0, z), point3(lengthMm, 0, z), point3(lengthMm, spanMm, z), point3(0, spanMm, z)];
}

function metersToMm(value: number | null | undefined, fallback = 0): number {
  return Math.round((value ?? fallback) * 1000);
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function frameAlongX(origin: Point3): DatumFrame3 {
  return {
    origin,
    xAxis: { x: 1, y: 0, z: 0 },
    yAxis: { x: 0, y: 0, z: 1 },
    zAxis: { x: 0, y: 1, z: 0 },
  };
}

function frameAlongY(origin: Point3): DatumFrame3 {
  return {
    origin,
    xAxis: { x: 0, y: 1, z: 0 },
    yAxis: { x: 0, y: 0, z: 1 },
    zAxis: { x: 1, y: 0, z: 0 },
  };
}

function frameAlongZ(origin: Point3): DatumFrame3 {
  return {
    origin,
    xAxis: { x: 0, y: 0, z: 1 },
    yAxis: { x: 1, y: 0, z: 0 },
    zAxis: { x: 0, y: 1, z: 0 },
  };
}

function profile(widthM: number | null | undefined, depthM: number | null | undefined) {
  return {
    shape: 'rectangular' as const,
    widthMm: metersToMm(widthM),
    depthMm: metersToMm(depthM),
  };
}

function normalizeConnectionType(value: DrawingAssemblyModel['houseContext']['connectionType']): ConnectionType {
  return value === 'none' ? 'freestanding' : value;
}

function roofTypeFor(current: DrawingAssemblyModel): Assembly3D['family'] {
  if (current.roof.boxPerimeterEnabled) return 'box';
  if (current.roof.pergolaStyle === 'gable') return 'gable';
  return 'mono';
}

function buildAttachmentEdge(side: DrawingAssemblyModel['houseContext']['attachmentSide'], lengthMm: number, spanMm: number, z: number) {
  if (side === 'right') {
    return { start: point3(lengthMm, 0, z), end: point3(lengthMm, spanMm, z) };
  }
  if (side === 'front') {
    return { start: point3(lengthMm, spanMm, z), end: point3(0, spanMm, z) };
  }
  if (side === 'left') {
    return { start: point3(0, spanMm, z), end: point3(0, 0, z) };
  }
  return { start: point3(0, 0, z), end: point3(lengthMm, 0, z) };
}

function buildWallPlane(side: DrawingAssemblyModel['houseContext']['attachmentSide']): Plane3 {
  if (side === 'right') {
    return {
      origin: point3(0, 0, 0),
      xAxis: { x: 0, y: 1, z: 0 },
      yAxis: { x: 0, y: 0, z: 1 },
      normal: { x: 1, y: 0, z: 0 },
    };
  }
  if (side === 'front') {
    return {
      origin: point3(0, 0, 0),
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: 1, z: 0 },
    };
  }
  if (side === 'left') {
    return {
      origin: point3(0, 0, 0),
      xAxis: { x: 0, y: 1, z: 0 },
      yAxis: { x: 0, y: 0, z: 1 },
      normal: { x: -1, y: 0, z: 0 },
    };
  }
  return {
    origin: point3(0, 0, 0),
    xAxis: { x: 1, y: 0, z: 0 },
    yAxis: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: -1, z: 0 },
  };
}

function toAssembly3D(current: DrawingAssemblyModel): Assembly3D {
  const lengthMm = Math.round((current.roof.footprint.lengthA ?? 0) * 1000);
  const spanMm = Math.round((current.roof.footprint.spanA ?? 0) * 1000);
  const outline = rectangle3(lengthMm, spanMm);
  const roofType = roofTypeFor(current);
  const attachmentSide = current.houseContext.attachmentSide;
  const pitchDeg = current.roof.pitchDeg ?? parsePositiveNumber(current.moduleInput.roofPitchDeg, 0);
  const riseMm = Math.round(Math.tan((pitchDeg * Math.PI) / 180) * spanMm);
  const halfRiseMm = Math.round(Math.tan((pitchDeg * Math.PI) / 180) * (spanMm / 2));
  const baseHeightMm = Math.round(parsePositiveNumber(current.moduleInput.postCutHeightM, 2.4) * 1000);
  const positiveYFall = current.roof.fallVector.y >= 0;
  const houseEdgeHeightMm = roofType === 'gable' ? baseHeightMm : positiveYFall ? baseHeightMm + riseMm : baseHeightMm;
  const outerEdgeHeightMm = roofType === 'gable' ? baseHeightMm : positiveYFall ? baseHeightMm : baseHeightMm + riseMm;
  const ridgeHeightMm = baseHeightMm + halfRiseMm;
  const attachmentEdge = buildAttachmentEdge(attachmentSide, lengthMm, spanMm, houseEdgeHeightMm);
  const rafterPositionsA =
    current.structure.rafters.positionsA.length > 0 ? current.structure.rafters.positionsA : [lengthMm / 2000];

  const roofPlanes =
    roofType === 'gable'
      ? [
          {
            id: 'gable-left',
            boundary: [
              point3(0, 0, baseHeightMm),
              point3(lengthMm, 0, baseHeightMm),
              point3(lengthMm, Math.round(spanMm / 2), ridgeHeightMm),
              point3(0, Math.round(spanMm / 2), ridgeHeightMm),
            ],
            plane: {
              origin: point3(0, 0, baseHeightMm),
              xAxis: { x: 1, y: 0, z: 0 },
              yAxis: { x: 0, y: spanMm / 2, z: halfRiseMm },
              normal: { x: 0, y: -halfRiseMm, z: spanMm / 2 },
            },
            fallVector: { x: 0, y: -1, z: -(halfRiseMm / Math.max(spanMm / 2, 1)) },
          },
          {
            id: 'gable-right',
            boundary: [
              point3(0, Math.round(spanMm / 2), ridgeHeightMm),
              point3(lengthMm, Math.round(spanMm / 2), ridgeHeightMm),
              point3(lengthMm, spanMm, baseHeightMm),
              point3(0, spanMm, baseHeightMm),
            ],
            plane: {
              origin: point3(0, Math.round(spanMm / 2), ridgeHeightMm),
              xAxis: { x: 1, y: 0, z: 0 },
              yAxis: { x: 0, y: spanMm / 2, z: -halfRiseMm },
              normal: { x: 0, y: halfRiseMm, z: spanMm / 2 },
            },
            fallVector: { x: 0, y: 1, z: -(halfRiseMm / Math.max(spanMm / 2, 1)) },
          },
        ]
      : [
          {
            id: `${roofType}-roof`,
            boundary: [
              point3(0, 0, houseEdgeHeightMm),
              point3(lengthMm, 0, houseEdgeHeightMm),
              point3(lengthMm, spanMm, outerEdgeHeightMm),
              point3(0, spanMm, outerEdgeHeightMm),
            ],
            plane: {
              origin: point3(0, 0, houseEdgeHeightMm),
              xAxis: { x: 1, y: 0, z: 0 },
              yAxis: { x: 0, y: spanMm, z: outerEdgeHeightMm - houseEdgeHeightMm },
              normal: { x: 0, y: houseEdgeHeightMm - outerEdgeHeightMm, z: spanMm },
            },
            fallVector: {
              x: current.roof.fallVector.x,
              y: current.roof.fallVector.y,
              z: outerEdgeHeightMm === houseEdgeHeightMm ? 0 : -Math.abs((outerEdgeHeightMm - houseEdgeHeightMm) / Math.max(spanMm, 1)),
            },
          },
        ];

  const posts = Array.from({ length: current.supportConditions.postCount ?? current.structure.posts.count ?? 0 }, (_, index) => {
    const x = index % 2 === 0 ? 0 : lengthMm;
    const y = index < 2 ? spanMm : Math.round(spanMm / 2);
    const origin = point3(x, y, 0);
    return {
      id: `post-${index + 1}`,
      role: 'post' as const,
      centerline: {
        start: origin,
        end: point3(x, y, baseHeightMm),
      },
      profile: profile(current.structure.posts.widthM, current.structure.posts.depthM),
      localFrame: frameAlongZ(origin),
      metadata: {
        role: index < 2 ? 'corner' : 'intermediate',
      },
    };
  });

  const members: Assembly3D['members'] = [
    ...posts,
    {
      id: 'ledger',
      role: 'ledger',
      centerline: {
        start: point3(0, 0, houseEdgeHeightMm),
        end: point3(lengthMm, 0, houseEdgeHeightMm),
      },
      profile: profile(current.structure.ledgerBeam.widthM, current.structure.ledgerBeam.depthM),
      localFrame: frameAlongX(point3(0, 0, houseEdgeHeightMm)),
    },
    {
      id: 'support',
      role: roofType === 'box' ? 'beam' : 'beam',
      centerline: {
        start: point3(0, spanMm, outerEdgeHeightMm),
        end: point3(lengthMm, spanMm, outerEdgeHeightMm),
      },
      profile: profile(current.structure.supportBeam.widthM, current.structure.supportBeam.depthM),
      localFrame: frameAlongX(point3(0, spanMm, outerEdgeHeightMm)),
      metadata: {
        beamRole: roofType === 'box' ? 'box_perimeter' : 'support',
      },
    },
    ...rafterPositionsA.map((position, index) => ({
      id: `rafter-${index + 1}`,
      role: 'rafter' as const,
      centerline: {
        start: point3(Math.round(position * 1000), 0, roofType === 'gable' ? baseHeightMm : houseEdgeHeightMm),
        end: point3(Math.round(position * 1000), spanMm, roofType === 'gable' ? baseHeightMm : outerEdgeHeightMm),
      },
      profile: profile(current.structure.rafters.widthM, current.structure.rafters.depthM),
      localFrame: frameAlongY(point3(Math.round(position * 1000), 0, roofType === 'gable' ? baseHeightMm : houseEdgeHeightMm)),
      metadata: {
        spacingMm: current.structure.rafters.spacingA ? Math.round(current.structure.rafters.spacingA * 1000) : null,
      },
    })),
    {
      id: 'outer-gutter',
      role: 'gutter',
      centerline: {
        start: point3(0, spanMm, outerEdgeHeightMm),
        end: point3(lengthMm, spanMm, outerEdgeHeightMm),
      },
      profile: profile(current.structure.gutter.widthM, current.structure.gutter.depthM),
      localFrame: frameAlongX(point3(0, spanMm, outerEdgeHeightMm)),
    },
    ...(current.structure.ridgeBeam.present
      ? [
          {
            id: 'ridge',
            role: 'ridge' as const,
            centerline: {
              start: point3(0, Math.round(spanMm / 2), ridgeHeightMm),
              end: point3(lengthMm, Math.round(spanMm / 2), ridgeHeightMm),
            },
            profile: profile(current.structure.ridgeBeam.widthM, current.structure.ridgeBeam.depthM),
            localFrame: frameAlongX(point3(0, Math.round(spanMm / 2), ridgeHeightMm)),
          },
        ]
      : []),
  ];

  return {
    family: roofType,
    datum: {
      origin: point3(0, 0, 0),
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: attachmentEdge.start,
      attachmentEdgeEnd: attachmentEdge.end,
    },
    outline,
    attachmentEdge,
    house: {
      wallPlane: buildWallPlane(attachmentSide),
      soffitDepthMm: current.houseContext.soffitBrackets.offsetM ? Math.round(current.houseContext.soffitBrackets.offsetM * 1000) : null,
    },
    members,
    roofPlanes,
    supportConditions: [
      {
        type: 'house_connection',
        memberId: 'ledger',
        metadata: {
          connectionType: normalizeConnectionType(current.supportConditions.houseConnectionType),
        },
      },
      {
        type: 'post_connection',
        memberId: posts[0]?.id ?? 'post-1',
        metadata: {
          postConnectionType: current.supportConditions.postConnectionType,
        },
      },
      {
        type: 'ground',
        memberId: posts[0]?.id ?? 'post-1',
        metadata: {
          ground: current.supportConditions.ground,
        },
      },
    ],
    quantityHooks: [
      { key: 'posts', quantity: posts.length, unit: 'count' },
      { key: 'rafters', quantity: rafterPositionsA.length, unit: 'count' },
      { key: 'roof_planes', quantity: roofPlanes.length, unit: 'count' },
    ],
    semantics: {
      connectionType: normalizeConnectionType(current.houseContext.connectionType),
      roofType,
      structuralZones: ['roof_field'],
    },
  };
}

describe('geometry contract compatibility', () => {
  it('can represent the current mono assembly intent inside the new Assembly3D contract', () => {
    const current = buildCurrentAssembly(
      makeModule({
        pergolaStyle: 'pitched',
        lengthM: '6',
        projectionM: '3',
      }),
      makeResult({
        roofType: 'pitched',
        lengthA: 6,
        spanA: 3,
      }),
    );

    const next = toAssembly3D(current);

    expect(next.family).toBe('mono');
    expect(next.semantics.connectionType).toBe('soffit');
    expect(next.members.map((member) => member.role)).toContain('ledger');
    expect(next.roofPlanes).toHaveLength(1);
  });

  it('can represent the current gable assembly intent inside the new Assembly3D contract', () => {
    const current = buildCurrentAssembly(
      makeModule({
        pergolaStyle: 'gable',
        lengthM: '6.5',
        projectionM: '4',
        roofPitchDeg: '25',
      }),
      makeResult({
        roofType: 'gable',
        lengthA: 6.5,
        spanA: 4,
        roofPitchDegUsed: 25,
        heightHouseSideM: 2.7,
        heightOuterSideM: 2.7,
      }),
    );

    const next = toAssembly3D(current);

    expect(next.family).toBe('gable');
    expect(next.members.map((member) => member.role)).toContain('ridge');
    expect(next.roofPlanes).toHaveLength(2);
    expect(next.semantics.roofType).toBe('gable');
  });

  it('can represent the current box-perimeter assembly intent inside the new Assembly3D contract', () => {
    const current = buildCurrentAssembly(
      makeModule({
        pergolaStyle: 'pitched',
        boxPerimeterEnabled: true,
        internalRoofType: 'flat',
        roofMaterial: 'timber',
        lengthM: '5.5',
        projectionM: '3.5',
        roofPitchDeg: '3',
      }),
      makeResult({
        roofType: 'pitched',
        lengthA: 5.5,
        spanA: 3.5,
        roofPitchDegUsed: 3,
      }),
    );

    const next = toAssembly3D(current);

    expect(next.family).toBe('box');
    expect(next.semantics.roofType).toBe('box');
    expect(next.quantityHooks).toContainEqual({ key: 'roof_planes', quantity: 1, unit: 'count' });
    expect(next.members.find((member) => member.id === 'support')?.metadata?.beamRole).toBe('box_perimeter');
  });
});
