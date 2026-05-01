import { renderToStaticMarkup } from 'react-dom/server';
import { act, useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { GeometryPlanMember2D, GeometryPlanViewModel, GeometryTopProjectionViewModel, Point2 } from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import {
  createDrawingWorkbenchUiState,
  type DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import { buildPlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { ObjectWorkbenchPlanOverlayInput } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { resolveDeckHostEdgeFrame, resolveDeckPresetGeometry } from '@/lib/drawings/state/objectWorkbenchDeckGeometry';
import type { DeckInteractionTelemetry } from '@/app/staff/projects/[projectId]/design-workbench/objectWorkbenchClientTypes';
import type {
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type {
  DeckModel,
  HouseModel,
  WallOpeningModel,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { dispatchPointer, renderIntoDocument } from '../../../../../test/reactHarness';
import ModelSpaceViewport from './ModelSpaceViewport';

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
    postCount: '2',
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

function makeResult(): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: 'pitched',
    },
    derived: {
      length_m: 6,
      projection_m: 3,
      slope_direction: 'away_from_house',
      roof_pitch_deg_used: 5,
      height_house_side_m: 2.4,
      height_outer_side_m: 2.1,
    },
  } as unknown as CostOutputV1;
}

function makeDrawingModule() {
  return buildEstimateDrawingModules({
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Test Project',
      quoteRef: 'Q-1000',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [makeModule()],
    },
    outputs: {
      pergolas: [{ id: 'pergola-1', modules: [makeResult()] }],
    },
  })[0]!;
}

function makeGeometryPlanFixture(): GeometryPlanViewModel {
  return {
    family: 'mono',
    connectionType: 'soffit',
    roofForm: {
      mono: true,
      gable: false,
      box: false,
    },
    outline: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    attachmentEdge: {
      start: { x: 0, y: 0 },
      end: { x: 6000, y: 0 },
    },
    house: {
      footprint: null,
      fasciaLine: null,
      roofEdgeLine: null,
      wallReferenceLine: null,
      surfaces: [],
      lines: [],
    },
    members: {
      posts: [
        {
          id: 'post-left',
          role: 'post',
          centerline: { start: { x: 500, y: 2450 }, end: { x: 500, y: 2450 } },
          profile: { shape: 'rectangular', widthMm: 90, depthMm: 90, profileKey: '90x90' },
          lengthMm: 0,
        },
      ],
      beams: [
        {
          id: 'support-beam-front',
          role: 'beam',
          centerline: { start: { x: 500, y: 2800 }, end: { x: 5600, y: 2800 } },
          profile: { shape: 'rectangular', widthMm: 150, depthMm: 50, profileKey: '150x50' },
          lengthMm: 5100,
        },
      ],
      ledgers: [
        {
          id: 'ledger-rear',
          role: 'ledger',
          centerline: { start: { x: 0, y: 120 }, end: { x: 6000, y: 120 } },
          profile: { shape: 'rectangular', widthMm: 100, depthMm: 50, profileKey: '100x50' },
          lengthMm: 6000,
        },
      ],
      rafters: [
        {
          id: 'rafter-a',
          role: 'rafter',
          centerline: { start: { x: 800, y: 220 }, end: { x: 800, y: 2840 } },
          profile: { shape: 'rectangular', widthMm: 50, depthMm: 150, profileKey: '50x150' },
          lengthMm: 2620,
        },
        {
          id: 'rafter-b',
          role: 'rafter',
          centerline: { start: { x: 2100, y: 220 }, end: { x: 2100, y: 2840 } },
          profile: { shape: 'rectangular', widthMm: 50, depthMm: 150, profileKey: '50x150' },
          lengthMm: 2620,
        },
        {
          id: 'rafter-c',
          role: 'rafter',
          centerline: { start: { x: 4500, y: 220 }, end: { x: 4500, y: 2840 } },
          profile: { shape: 'rectangular', widthMm: 50, depthMm: 150, profileKey: '50x150' },
          lengthMm: 2620,
        },
      ],
      gutters: [
        {
          id: 'gutter-front',
          role: 'gutter',
          centerline: { start: { x: 0, y: 2940 }, end: { x: 6000, y: 2940 } },
          profile: { shape: 'rectangular', widthMm: 120, depthMm: 150, profileKey: '120x150' },
          lengthMm: 6000,
        },
      ],
      ridge: [],
      joiners: [
        {
          id: 'joiner-run-1',
          role: 'joiner',
          centerline: { start: { x: 3200, y: 280 }, end: { x: 3200, y: 2750 } },
          profile: { shape: 'rectangular', widthMm: 40, depthMm: 40, profileKey: '40x40' },
          lengthMm: 2470,
        },
      ],
    },
    surfaces: {
      roofPlanes: [
        {
          id: 'roof-plane-main',
          kind: 'roof_plane',
          boundary: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 3000 },
            { x: 0, y: 3000 },
          ],
        },
      ],
      roofCladding: [
        {
          id: 'roof-cladding-main',
          kind: 'roof_cladding',
          boundary: [
            { x: 140, y: 140 },
            { x: 5860, y: 140 },
            { x: 5860, y: 2860 },
            { x: 140, y: 2860 },
          ],
        },
      ],
    },
    anchors: {
      primarySize: {
        length: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
        projection: { start: { x: 0, y: 0 }, end: { x: 0, y: 3000 } },
      },
      fall: {
        point: { x: 2600, y: 1500 },
        direction: { x: 0, y: 1 },
        dual: false,
      },
      rafterSpacing: {
        line: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
        positionsMm: [800, 2100, 4500],
      },
      ridgeLine: null,
      attachmentSide: {
        line: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
      },
    },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 6000,
      maxY: 3000,
      lengthMm: 6000,
      projectionMm: 3000,
    },
  };
}

function makeGeometryPlanFromPlanModel(planModel: ModulePlanModel, house?: HouseModel | null): GeometryPlanViewModel {
  const base = makeGeometryPlanFixture();
  const houseSurfaces = (planModel.houseContext?.surfaces ?? []).map((surface) => ({
    ...surface,
    boundary: surface.boundary.map((point) => ({
      x: point.x * 1000,
      y: point.y * 1000,
    })),
  }));
  const houseLines = (planModel.houseContext?.lines ?? []).map((line) => ({
    ...line,
    line: {
      start: {
        x: line.line.start.x * 1000,
        y: line.line.start.y * 1000,
      },
      end: {
        x: line.line.end.x * 1000,
        y: line.line.end.y * 1000,
      },
    },
  }));
  const footprintSurface = houseSurfaces.find((surface) => surface.kind === 'footprint') ?? null;
  const localHousePoints =
    house?.footprint.polygon
      .map((point) => ({
        x: Number(point.alongM),
        y: Number(point.depthM),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ?? [];
  const fallbackLocalHouseBounds =
    house && localHousePoints.length === 0
      ? (() => {
          const widthM = Number(house.footprint.params.widthM);
          const depthM = Math.max(
            Number(house.footprint.params.bandDepthM),
            Number(house.footprint.params.returnRunM),
            Number(house.footprint.params.leftLegRunM),
            Number(house.footprint.params.rightLegRunM),
            Number(house.footprint.params.sideRunM),
            0,
          );
          return Number.isFinite(widthM) && widthM > 0 && Number.isFinite(depthM) && depthM > 0
            ? {
                minX: 0,
                maxX: widthM,
                minY: 0,
                maxY: depthM,
              }
            : null;
        })()
      : null;
  const localHouseBounds = localHousePoints.length
    ? {
        minX: Math.min(...localHousePoints.map((point) => point.x)),
        maxX: Math.max(...localHousePoints.map((point) => point.x)),
        minY: Math.min(...localHousePoints.map((point) => point.y)),
        maxY: Math.max(...localHousePoints.map((point) => point.y)),
      }
    : fallbackLocalHouseBounds;
  const geometryHouseBounds = footprintSurface
    ? {
        minX: Math.min(...footprintSurface.boundary.map((point) => point.x / 1000)),
        maxX: Math.max(...footprintSurface.boundary.map((point) => point.x / 1000)),
        minY: Math.min(...footprintSurface.boundary.map((point) => point.y / 1000)),
        maxY: Math.max(...footprintSurface.boundary.map((point) => point.y / 1000)),
      }
    : null;
  const transformLocalPoint = (point: { alongM: string; depthM: string }) => {
    const x = Number(point.alongM);
    const y = Number(point.depthM);
    if (!localHouseBounds || !geometryHouseBounds) {
      return { x: x * 1000, y: y * 1000 };
    }
    const xScale = (geometryHouseBounds.maxX - geometryHouseBounds.minX) / Math.max(localHouseBounds.maxX - localHouseBounds.minX, 1e-6);
    const yScale = (geometryHouseBounds.maxY - geometryHouseBounds.minY) / Math.max(localHouseBounds.maxY - localHouseBounds.minY, 1e-6);
    return {
      x: (geometryHouseBounds.minX + (x - localHouseBounds.minX) * xScale) * 1000,
      y: (geometryHouseBounds.minY + (y - localHouseBounds.minY) * yScale) * 1000,
    };
  };
  const deckSurfaces =
    house?.decks
      .filter((deck): deck is HouseModel['decks'][number] => Boolean(deck))
      .filter((deck) => deck.outline.length >= 3)
      .map((deck) => ({
        id: deck.id,
        kind: 'deck' as const,
        boundary: deck.outline.map(transformLocalPoint),
      })) ?? [];
  return {
    ...base,
    house: {
      ...base.house,
      footprint: houseSurfaces.find((surface) => surface.kind === 'footprint')?.boundary ?? base.house.footprint,
      surfaces: [...houseSurfaces, ...deckSurfaces],
      lines: houseLines,
    },
  };
}

function memberProjectionPolygon(member: GeometryPlanMember2D): Point2[] {
  const start = member.centerline.start;
  const end = member.centerline.end;
  const widthMm = Math.max(member.profile.widthMm, 40);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) {
    const half = widthMm / 2;
    return [
      { x: start.x - half, y: start.y - half },
      { x: start.x + half, y: start.y - half },
      { x: start.x + half, y: start.y + half },
      { x: start.x - half, y: start.y + half },
    ];
  }
  const half = widthMm / 2;
  const nx = -dy / length;
  const ny = dx / length;
  return [
    { x: start.x + nx * half, y: start.y + ny * half },
    { x: end.x + nx * half, y: end.y + ny * half },
    { x: end.x - nx * half, y: end.y - ny * half },
    { x: start.x - nx * half, y: start.y - ny * half },
  ];
}

function makeTopProjectionFromGeometryPlan(geometryPlan: GeometryPlanViewModel): GeometryTopProjectionViewModel {
  const houseSurfaceShapes = (geometryPlan.house.surfaces ?? []).map((surface, index) => ({
    id: `house_surface:${surface.id}`,
    sourceObjectId: `house-scene-${surface.id}`,
    sourceId: surface.id,
    sourceType: 'house_surface' as const,
    family: 'house' as const,
    kind: surface.kind,
    polygon: surface.boundary,
    zOrder: 10 + index,
    zMin: 0,
    zMax: 0,
    metadata: surface.kind === 'deck' ? { ...(surface.metadata ?? {}), sourceId: surface.id } : surface.metadata,
  }));
  const pergolaSurfaceShapes = [
    ...geometryPlan.surfaces.roofPlanes.map((surface, index) => ({
      id: `roof_plane:${surface.id}`,
      sourceObjectId: `scene-${surface.id}`,
      sourceId: surface.id,
      sourceType: 'roof_plane' as const,
      family: 'pergola' as const,
      kind: 'roof_plane',
      polygon: surface.boundary,
      zOrder: 60 + index,
      zMin: 2400,
      zMax: 2600,
      metadata: surface.metadata,
    })),
    ...geometryPlan.surfaces.roofCladding.map((surface, index) => ({
      id: `roof_cladding_panel:${surface.id}`,
      sourceObjectId: `scene-${surface.id}`,
      sourceId: surface.id,
      sourceType: 'roof_cladding_panel' as const,
      family: 'pergola' as const,
      kind: 'roof_cladding',
      polygon: surface.boundary,
      zOrder: 64 + index,
      zMin: 2400,
      zMax: 2600,
      metadata: surface.metadata,
    })),
  ];
  const memberShapes = [
    ...geometryPlan.members.posts,
    ...geometryPlan.members.beams,
    ...geometryPlan.members.ledgers,
    ...geometryPlan.members.gutters,
    ...geometryPlan.members.joiners,
    ...geometryPlan.members.rafters,
    ...geometryPlan.members.ridge,
  ].map((member, index) => ({
    id: `member_prism:${member.id}`,
    sourceObjectId: `scene-${member.id}`,
    sourceId: member.id,
    sourceType: 'member_prism' as const,
    family: 'pergola' as const,
    kind: member.role,
    polygon: memberProjectionPolygon(member),
    zOrder: 70 + index,
    zMin: 2200,
    zMax: 2600,
    metadata: {
      centerlineMm: `${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`,
    },
  }));
  const shapes = [...houseSurfaceShapes, ...pergolaSurfaceShapes, ...memberShapes];
  const points = shapes.flatMap((shape) => shape.polygon);
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_left',
      y: 'world_y_down',
    },
    shapes,
    extents: points.length
      ? {
          minX: Math.min(...points.map((point) => point.x)),
          minY: Math.min(...points.map((point) => point.y)),
          maxX: Math.max(...points.map((point) => point.x)),
          maxY: Math.max(...points.map((point) => point.y)),
          widthMm: Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)),
          heightMm: Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)),
        }
      : null,
  };
}

function TestModelSpaceViewport(props: ComponentProps<typeof ModelSpaceViewport>) {
  const planViewModel =
    props.planViewModel ??
    (props.view === 'plan' && props.planModel
      ? buildPlanViewModel({
          moduleId: 'module-1',
          moduleLabel: 'Module 1',
          planModel: props.planModel,
          geometryPlan: makeGeometryPlanFromPlanModel(props.planModel),
          geometryTopProjection: makeTopProjectionFromGeometryPlan(makeGeometryPlanFromPlanModel(props.planModel)),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
          canEditHouseFootprint: Boolean(props.onCommitFootprintEdit),
        })
      : props.planViewModel);
  return <ModelSpaceViewport {...props} planViewModel={planViewModel} />;
}

function makePlanEditableFields(): EstimateDrawingField[] {
  return [
    {
      id: 'plan:lengthA',
      label: 'Plan length',
      rawValue: '6',
      displayValue: '6.00m',
      svgFieldId: 'plan:lengthA',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: 0, field: 'lengthM' },
    },
    {
      id: 'plan:spanA',
      label: 'Plan span',
      rawValue: '3',
      displayValue: '3.00m',
      svgFieldId: 'plan:spanA',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: 0, field: 'projectionM' },
    },
  ];
}

function makePlanModelWithHouseContext(): ModulePlanModel {
  const drawing = makeDrawingModule();
  return {
    ...drawing.planModel!,
    houseContext: {
      surfaces: [
        {
          id: 'house-footprint',
          kind: 'footprint',
          boundary: [
            { x: 0, y: -1.8 },
            { x: 6, y: -1.8 },
            { x: 6, y: 0 },
            { x: 0, y: 0 },
          ],
        },
      ],
      lines: [
        {
          id: 'house-wall-segment-rear',
          kind: 'wall_segment',
          line: { start: { x: 0, y: -1.8 }, end: { x: 6, y: -1.8 } },
          metadata: { sourceEdgeId: 'footprint-edge-1' },
        },
        {
          id: 'house-wall-segment-right',
          kind: 'wall_segment',
          line: { start: { x: 6, y: -1.8 }, end: { x: 6, y: 0 } },
          metadata: { sourceEdgeId: 'footprint-edge-2' },
        },
        {
          id: 'house-wall-segment-front',
          kind: 'wall_segment',
          line: { start: { x: 6, y: 0 }, end: { x: 0, y: 0 } },
          metadata: { sourceEdgeId: 'footprint-edge-3' },
        },
        {
          id: 'house-wall-segment-left',
          kind: 'wall_segment',
          line: { start: { x: 0, y: 0 }, end: { x: 0, y: -1.8 } },
          metadata: { sourceEdgeId: 'footprint-edge-4' },
        },
        {
          id: 'house-attachment-target',
          kind: 'attachment_target',
          line: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } },
        },
      ],
    },
  };
}

function makePlanModelWithLargeHouseContext(): ModulePlanModel {
  return {
    ...makePlanModelWithHouseContext(),
    houseContext: {
      surfaces: [
        {
          id: 'house-footprint-large',
          kind: 'footprint',
          boundary: [
            { x: -80, y: -60 },
            { x: 140, y: -60 },
            { x: 140, y: 0 },
            { x: -80, y: 0 },
          ],
        },
      ],
      lines: [],
    },
  };
}

function makePlanModelWithSemanticHouseBoundary(boundary: Array<{ x: number; y: number }>): ModulePlanModel {
  return {
    ...makePlanModelWithHouseContext(),
    houseContext: {
      surfaces: [
        {
          id: 'house-footprint',
          kind: 'footprint',
          boundary,
        },
      ],
      lines: [],
    },
  };
}

function makeCustomPolygonPlanModel(): ModulePlanModel {
  return {
    ...makePlanModelWithHouseContext(),
    houseFootprintMode: 'custom_polygon',
    houseFootprintPolygon: [
      { alongM: '0', depthM: '2.4' },
      { alongM: '6', depthM: '2.4' },
      { alongM: '6', depthM: '0' },
      { alongM: '0', depthM: '0' },
    ],
  };
}

function makeHouseFirstDeck(overrides: Partial<DeckModel> = {}): DeckModel {
  return {
    id: 'deck-1',
    name: 'Deck 1',
    kind: 'deck',
    shape: 'preset',
    presetType: 'rect_attached',
    presetRect: {
      widthM: '4',
      depthM: '3',
      centerOffsetM: '0',
    },
    outline: [],
    elevationMode: 'aligned_to_threshold',
    levelOffsetMm: '0',
    hostEdgeId: 'rear',
    isAttached: true,
    surfaceMaterial: 'timber_decking',
    topSurfaceElevationMm: 0,
    supportContext: {
      classification: 'threshold_attached',
      nearestHouseEdgeId: 'rear',
      nearestHouseEdgeDistanceMm: 0,
      attachmentContactLengthMm: 0,
      warningCodes: [],
      warningMessages: [],
    },
    validation: {
      status: 'valid',
      codes: [],
      messages: [],
      message: null,
    },
    ...overrides,
  };
}

function buildDerivedWallGraph(
  polygon: Array<{ alongM: string; depthM: string }>,
  houseId = 'house-main',
): HouseModel['derivedWallGraph'] {
  const sideCounts = new Map<'rear' | 'front' | 'left' | 'right', number>();
  const walls = polygon.flatMap((point, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length];
    if (!nextPoint) return [];
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    const frame = resolveDeckHostEdgeFrame({
      housePolygon: polygon,
      hostEdgeId: sourceEdgeId,
    });
    if (!frame?.sourceEdgeId) return [];
    const nextCount = (sideCounts.get(frame.hostEdge) ?? 0) + 1;
    sideCounts.set(frame.hostEdge, nextCount);
    const labelPrefix = `${frame.hostEdge.charAt(0).toUpperCase()}${frame.hostEdge.slice(1)} wall`;
    return [
      {
        id: `wall-${frame.sourceEdgeId}`,
        label: nextCount === 1 ? labelPrefix : `${labelPrefix} ${nextCount}`,
        sourceFormIds: [houseId],
        edgeIds: [frame.sourceEdgeId],
        kind: 'exterior' as const,
        polygon: [point, nextPoint],
      },
    ];
  });
  return {
    walls,
    mergeGroups: [],
  };
}

function makeHouseFirstHouse(overrides: Partial<HouseModel> = {}): HouseModel {
  const house: HouseModel = {
    id: 'house-main',
    label: 'House',
    confidence: 'high',
    lowConfidence: false,
    sourceModuleIndexes: [0],
    sourceModuleIds: ['module-1'],
    footprint: {
      mode: 'preset',
      preset: 'straight',
      params: {
        widthM: '6',
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
      polygon: [
        { alongM: '0', depthM: '0' },
        { alongM: '6', depthM: '0' },
        { alongM: '6', depthM: '2.4' },
        { alongM: '0', depthM: '2.4' },
      ],
      drawingRotationQuarterTurns: 0,
      attachmentSide: 'rear',
    },
    roof: {
      id: 'roof-1',
      form: 'mono',
      material: 'corrugated_iron',
      pitchDeg: '5',
      primaryPitchDeg: '5',
      primaryFallDirection: 'positive_y',
      ridgeAxis: 'x',
      openGableEndIds: [],
      terminalEnds: [],
      appendage: {
        enabled: false,
        form: 'flat',
        hostEdge: 'rear',
        pitchDeg: '3',
        dropMm: '0',
      },
      geometryKind: null,
      appendageSupportedHostEdges: ['rear', 'front', 'left', 'right'],
      appendageSupportReason: null,
      validation: {
        status: 'valid',
        code: null,
        message: null,
      },
      capabilities: {
        roofForm: 'mono',
        controls: {
          pitch: true,
          material: true,
          primaryFallDirection: true,
          ridgeAxis: false,
          appendage: true,
        },
        footprintTopology: 'orthogonal',
        selectedFormFootprintRequirement: 'orthogonal',
        selectedFormSupported: true,
        appendageFootprintRequirement: 'rectangular',
        appendageSupported: true,
      },
      confidence: 'high',
      source: 'house_first_draft',
    },
    storeyMode: 'single_storey',
    attachmentStrategy: 'soffit_brackets',
    eaveHeightM: '2.7',
    wallHeightM: '2.4',
    soffitDepthMm: '450',
    fasciaHeightMm: '140',
    gutterWidthMm: '115',
    gutterDepthMm: '85',
    gutterProjectionMm: '90',
    eaveOverhangMm: '450',
    derivedEnvelope: null,
    derivedWallGraph: {
      walls: [],
      mergeGroups: [],
    },
    decks: [],
    openings: [],
    attachmentZones: [],
    attachmentZoneDiagnostics: { blocked: [] },
  };
  const resolvedHouse = {
    ...house,
    ...overrides,
    footprint: {
      ...house.footprint,
      ...overrides.footprint,
      params: {
        ...house.footprint.params,
        ...overrides.footprint?.params,
      },
    },
    roof: {
      ...house.roof,
      ...overrides.roof,
      appendage: {
        ...house.roof.appendage,
        ...overrides.roof?.appendage,
      },
      validation: {
        ...house.roof.validation,
        ...overrides.roof?.validation,
      },
      capabilities: {
        ...house.roof.capabilities,
        ...overrides.roof?.capabilities,
      },
    },
  };
  return {
    ...resolvedHouse,
    derivedWallGraph:
      overrides.derivedWallGraph ??
      buildDerivedWallGraph(resolvedHouse.footprint.polygon, resolvedHouse.id),
  };
}

function polygonCentroidY(element: Element | null): number {
  const pointsAttr = element?.getAttribute('points');
  if (!pointsAttr) throw new Error('Missing polygon points.');
  const pairs = pointsAttr
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map((value) => Number.parseFloat(value)));
  const ys = pairs.map(([, y]) => y).filter((value): value is number => Number.isFinite(value));
  if (!ys.length) throw new Error('Missing polygon Y coordinates.');
  return ys.reduce((sum, value) => sum + value, 0) / ys.length;
}

function polygonCentroidX(element: Element | null): number {
  const pointsAttr = element?.getAttribute('points');
  if (!pointsAttr) throw new Error('Missing polygon points.');
  const pairs = pointsAttr
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map((value) => Number.parseFloat(value)));
  const xs = pairs.map(([x]) => x).filter((value): value is number => Number.isFinite(value));
  if (!xs.length) throw new Error('Missing polygon X coordinates.');
  return xs.reduce((sum, value) => sum + value, 0) / xs.length;
}

function polygonPointsAttr(element: Element | null): string {
  const pointsAttr = element?.getAttribute('points');
  if (!pointsAttr) throw new Error('Missing polygon points.');
  return pointsAttr;
}

function normalizePolygonPointSet(pointsAttr: string): string {
  return pointsAttr
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map((value) => Number.parseFloat(value)))
    .sort((left, right) => (left[0] ?? 0) - (right[0] ?? 0) || (left[1] ?? 0) - (right[1] ?? 0))
    .map(([x, y]) => `${x?.toFixed(2) ?? 'NaN'},${y?.toFixed(2) ?? 'NaN'}`)
    .join(' ');
}

function parseViewBoxAttr(value: string | null | undefined): { x: number; y: number; width: number; height: number } {
  if (!value) throw new Error('Missing viewBox attribute.');
  const parts = value.split(/\s+/).map((part) => Number.parseFloat(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid viewBox attribute: ${value}`);
  }
  const [x, y, width, height] = parts;
  return { x: x!, y: y!, width: width!, height: height! };
}

function getViewportTransformSnapshot(container: HTMLElement): { panX: number; panY: number; zoom: number } {
  const panX = Number.parseFloat(container.querySelector('[data-testid="viewport-pan-x"]')?.textContent ?? '');
  const panY = Number.parseFloat(container.querySelector('[data-testid="viewport-pan-y"]')?.textContent ?? '');
  const zoom = Number.parseFloat(container.querySelector('[data-testid="viewport-zoom"]')?.textContent ?? '');
  if (!Number.isFinite(panX) || !Number.isFinite(panY) || !Number.isFinite(zoom)) {
    throw new Error('Missing viewport transform snapshot.');
  }
  return { panX, panY, zoom };
}

function makeHouseFirstOpening(overrides: Partial<WallOpeningModel> = {}): WallOpeningModel {
  return {
    id: 'opening-1',
    label: 'Window 1',
    kind: 'window',
    panelCount: null,
    hostWallId: null,
    wallId: 'rear',
    hostEdgeId: 'rear',
    widthM: '1.8',
    heightM: '1.2',
    sillHeightM: '0.9',
    offsetAlongWallM: '0.6',
    validation: {
      status: 'valid',
      codes: [],
      message: null,
    },
    ...overrides,
  };
}

function makeObjectWorkbenchOverlayInputFromHouse(input: {
  drawing: ReturnType<typeof makeDrawingModule>;
  house: HouseModel;
  planModel: ModulePlanModel;
  selection: ObjectWorkbenchViewportTargetSelection;
}): ObjectWorkbenchPlanOverlayInput {
  const houseForm = {
    id: input.house.id,
    label: input.house.label,
    transform: {
      offsetXM: 0,
      offsetYM: 0,
      rotationQuarterTurns: input.house.footprint.drawingRotationQuarterTurns,
    },
    footprint: {
      mode: input.house.footprint.mode,
      preset: input.house.footprint.preset,
      params: input.house.footprint.params,
      polygon: input.house.footprint.polygon,
      attachmentSide: input.house.footprint.attachmentSide,
    },
    roofIntent: {
      form: input.house.roof.form,
      material: input.house.roof.material,
      primaryPitchDeg: input.house.roof.primaryPitchDeg,
      primaryFallDirection: input.house.roof.primaryFallDirection,
      ridgeAxis: input.house.roof.ridgeAxis,
      openGableEndIds: input.house.roof.openGableEndIds,
      appendage: input.house.roof.appendage,
    },
    storeyMode: input.house.storeyMode,
    attachmentStrategy: input.house.attachmentStrategy,
    eaveHeightM: input.house.eaveHeightM,
    wallHeightM: input.house.wallHeightM,
    soffitDepthMm: input.house.soffitDepthMm,
    fasciaHeightMm: input.house.fasciaHeightMm,
    gutterWidthMm: input.house.gutterWidthMm,
    gutterDepthMm: input.house.gutterDepthMm,
    gutterProjectionMm: input.house.gutterProjectionMm,
    eaveOverhangMm: input.house.eaveOverhangMm,
    sourceModuleIndexes: input.house.sourceModuleIndexes,
    sourceModuleIds: input.house.sourceModuleIds,
  };
  return {
    houseAssembly: {
      id: 'assembly-main',
      label: input.house.label,
      houseForms: [houseForm],
      derivedEnvelope: {
        mergedFormIds: [input.house.id],
        footprint: input.house.footprint.polygon,
        wallGraph: input.house.derivedWallGraph,
        roofZones: [],
        edges: [],
        attachmentZones: input.house.attachmentZones.map((zone) => ({
          ...zone,
          sourceFormIds: [input.house.id],
          hostWallId: null,
          hostEdgeId: null,
          hostRoofZoneId: null,
        })),
      },
    },
    houseForm,
    decks: (input.house.decks ?? []).flatMap((deck) =>
      deck
        ? [
            {
              id: deck.id,
              label: deck.name ?? deck.id,
              kind: deck.kind,
              shape: deck.shape,
              presetType: deck.presetType,
              presetRect: deck.presetRect,
              floatingRect: deck.floatingRect,
              outline: deck.outline,
              elevationMode: deck.elevationMode,
              levelOffsetMm: deck.levelOffsetMm,
              isAttached: deck.isAttached,
              surfaceMaterial: deck.surfaceMaterial,
              hostEdgeId: deck.hostEdgeId,
              attachmentMode: deck.attachmentMode,
              primaryHostEdgeId: deck.primaryHostEdgeId,
              secondaryHostEdgeId: deck.secondaryHostEdgeId,
              cornerVertexId: deck.cornerVertexId,
            },
          ]
        : [],
    ),
    openings: input.house.openings.map((opening) => ({
      id: opening.id,
      label: opening.label,
      kind: opening.kind,
      panelCount: opening.panelCount,
      hostWallId: opening.hostWallId,
      wallId: opening.wallId,
      hostEdgeId: opening.hostEdgeId,
      widthM: opening.widthM,
      heightM: opening.heightM,
      sillHeightM: opening.sillHeightM,
      offsetAlongWallM: opening.offsetAlongWallM,
    })),
    selection: input.selection,
    moduleLengthM: input.drawing.input.lengthM,
    moduleProjectionM: input.drawing.input.projectionM,
    geometryPlan: makeGeometryPlanFromPlanModel(input.planModel, input.house),
    geometryTopProjection: makeTopProjectionFromGeometryPlan(makeGeometryPlanFromPlanModel(input.planModel, input.house)),
    status: {
      houseForm: {
        lowConfidence: input.house.lowConfidence,
        warnings: [],
        footprintPreset: input.house.footprint.preset,
        roofForm: input.house.roof.form,
        defaultDeckHostEdgeId: input.house.footprint.attachmentSide,
        attachmentZoneBlockedSummary: 'none',
        roof: {
          form: input.house.roof.form,
          controls: input.house.roof.capabilities.controls,
          selectedFormSupported: input.house.roof.capabilities.selectedFormSupported,
          appendageSupported: input.house.roof.capabilities.appendageSupported,
          appendageSupportedHostEdges: input.house.roof.appendageSupportedHostEdges ?? [],
          appendageSupportReason: input.house.roof.appendageSupportReason ?? null,
          terminalEnds: input.house.roof.terminalEnds,
          geometryKind: input.house.roof.geometryKind ?? null,
          validationStatus: input.house.roof.validation.status,
          validationCode: input.house.roof.validation.code,
          validationMessage: input.house.roof.validation.message,
          approximationReasons: input.house.roof.validation.approximationReasons ?? [],
          provenance: input.house.roof.provenance ?? {},
        },
      },
      deckStatuses: Object.fromEntries(
        (input.house.decks ?? []).flatMap((deck) => deck ? [
          [
            deck.id,
            {
              validation: deck.validation,
              supportWarnings: {
                codes: deck.supportContext.warningCodes,
                messages: deck.supportContext.warningMessages,
              },
              interaction: {
                selectedDeckType: deck.shape === 'custom' ? 'custom_outline' : deck.isAttached ? 'preset_snapped' : 'preset_floating',
                dragEligible: true,
                dragReason: null,
                hostEdgeResolvable: true,
                relationshipDimensionsAvailable: true,
                selectionBadgeLabel: 'Drag deck',
              },
            },
          ],
        ] : []),
      ),
      openingStatuses: Object.fromEntries(
        input.house.openings.map((opening) => [
          opening.id,
          {
            validation: opening.validation,
          },
        ]),
      ),
      pergolaStatuses: {},
      activeDeckSupport: null,
      activeDeckInteraction: null,
      deckSupportWarningCount: input.house.decks.reduce(
        (sum, deck) => sum + deck.supportContext.warningCodes.length,
        0,
      ),
    },
  };
}

function clickElement(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function fillAndCommitDimensionInput(input: HTMLInputElement, value: string, commit: 'enter' | 'blur'): void {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) throw new Error('Missing HTMLInputElement value setter.');
  act(() => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (commit === 'enter') {
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
    });
    return;
  }
  act(() => {
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  });
}

type HouseFirstViewportHarnessProps = {
  initialHouse: HouseModel;
  initialSelection?: ObjectWorkbenchViewportTargetSelection;
  rejectDeckCommit?: boolean;
  enablePlanEditing?: boolean;
  delayDeckCommit?: boolean;
  forceDeckCommitMismatch?: boolean;
  wrapInScrollableAncestor?: boolean;
  onDeckInteractionTelemetryChange?: (telemetry: DeckInteractionTelemetry) => void;
  onDeckCommit?: (deckId: string, patch: Partial<DeckModel>) => void;
  renderSelectionControls?: boolean;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
};

function HouseFirstViewportHarness({
  initialHouse,
  initialSelection = { kind: 'house', targetId: null },
  rejectDeckCommit = false,
  enablePlanEditing = true,
  delayDeckCommit = false,
  forceDeckCommitMismatch = false,
  wrapInScrollableAncestor = false,
  onDeckInteractionTelemetryChange,
  onDeckCommit,
  renderSelectionControls = false,
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
}: HouseFirstViewportHarnessProps) {
  const drawing = makeDrawingModule();
  const [house, setHouse] = useState(initialHouse);
  const [selection, setSelection] = useState<ObjectWorkbenchViewportTargetSelection>(initialSelection);
  const [viewportTransform, setViewportTransform] = useState(createDrawingWorkbenchUiState().viewportTransform);
  const [pendingDeckCommit, setPendingDeckCommit] = useState<null | (() => void)>(null);
  const [deckTelemetry, setDeckTelemetry] = useState<{
    hoveredDeckId: string | null;
    housePolygonSource: string | null;
    selectedDeckType: string;
    dragEligible: boolean;
    hostEdgeResolvable: boolean;
    relationshipDimensionsAvailable: boolean;
    releaseOutcome: string;
    releasePlacement: string | null;
    settleVisualState: string | null;
    affordanceState: string;
    referenceGuideState: string;
    snapState: string;
    snapMessage: string | null;
  } | null>(null);
  const planModel = makePlanModelWithHouseContext();
  const geometryPlan = makeGeometryPlanFromPlanModel(planModel, house);

  const viewport = (
    <TestModelSpaceViewport
      view="plan"
      objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
      visibility={visibility}
      status="ready"
      planModel={planModel}
      sectionModel={drawing.sectionModel}
      planViewModel={buildPlanViewModel({
        moduleId: drawing.id,
        moduleLabel: 'Module 1',
        planModel,
        geometryPlan,
        geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
        pergolaRenderSource: 'geometry',
        pergolaRenderStatus: 'geometry_ready',
        canEditHouseFootprint: true,
        objectWorkbenchOverlayInput: makeObjectWorkbenchOverlayInputFromHouse({
          drawing,
          house,
          planModel,
          selection,
        }),
      })}
      viewportTransform={viewportTransform}
      onViewportTransformChange={setViewportTransform}
      editableFields={enablePlanEditing ? makePlanEditableFields() : undefined}
      onCommitField={enablePlanEditing ? (() => ({ ok: true })) : undefined}
      onCommitFootprintEdit={() => ({ ok: true })}
      onSelectObjectWorkbenchTarget={(nextSelection) => {
        setSelection(nextSelection);
      }}
      onClearWorkbenchSelection={() => {
        setSelection({ kind: 'house', targetId: null });
      }}
      onCommitHouseFormFootprintDimension={(edit) => {
        setHouse((current) => {
          if (edit.type === 'param') {
            return {
              ...current,
              footprint: {
                ...current.footprint,
                params: {
                  ...current.footprint.params,
                  [edit.key]: edit.value,
                },
              },
            };
          }
          if (edit.type === 'polygon') {
            return {
              ...current,
              footprint: {
                ...current.footprint,
                mode: 'custom_polygon',
                polygon: edit.polygon,
              },
            };
          }
          return {
            ...current,
          };
        });
        return { ok: true };
      }}
      onCommitDeckDimension={(deckId, patch) => {
        onDeckCommit?.(deckId, patch as Partial<DeckModel>);
        if (rejectDeckCommit) return { ok: false, error: 'Deck dimension rejected.' };
        const applyCommit = () => {
          setHouse((current) => ({
            ...current,
            decks: current.decks.map((deck) => {
              if (deck.id !== deckId) return deck;
              const patchedDeck = {
                ...deck,
                ...patch,
                floatingRect:
                  patch.floatingRect === undefined
                    ? deck.floatingRect
                    : patch.floatingRect === null
                      ? null
                      : {
                          ...(deck.floatingRect ?? {}),
                          ...patch.floatingRect,
                        },
                presetRect:
                  patch.presetRect === undefined
                    ? deck.presetRect
                    : {
                        ...(deck.presetRect ?? {}),
                        ...patch.presetRect,
                      },
              } as DeckModel;
              const nextDeck =
                forceDeckCommitMismatch && patchedDeck.presetRect
                  ? {
                      ...patchedDeck,
                      presetRect: {
                        ...patchedDeck.presetRect,
                        centerOffsetM: String(Number(patchedDeck.presetRect.centerOffsetM ?? '0') + 1),
                      },
                    }
                  : patchedDeck;
              if (nextDeck.shape !== 'preset') return nextDeck;
              const resolvedDeck = resolveDeckPresetGeometry({
                deck: nextDeck as any,
                housePolygon: current.footprint.polygon,
              });
              return {
                ...nextDeck,
                hostEdgeId: resolvedDeck.hostEdgeId,
                floatingRect: resolvedDeck.floatingRect,
                presetRect: resolvedDeck.presetRect,
                outline: resolvedDeck.outline,
              };
            }),
          }));
        };
        if (!delayDeckCommit) {
          applyCommit();
          return { ok: true };
        }
        return new Promise<{ ok: boolean }>((resolve) => {
          setPendingDeckCommit(() => () => {
            applyCommit();
            resolve({ ok: true });
          });
        });
      }}
      onCommitOpeningDimension={(openingId, patch) => {
        setHouse((current) => ({
          ...current,
          openings: current.openings.map((opening) =>
            opening.id === openingId
              ? {
                  ...opening,
                  ...(patch.label !== undefined ? { label: patch.label ?? opening.label } : null),
                  ...(patch.kind !== undefined ? { kind: patch.kind ?? opening.kind } : null),
                  ...(patch.wallId !== undefined ? { wallId: patch.wallId ?? opening.wallId } : null),
                  ...(patch.hostEdgeId !== undefined ? { hostEdgeId: patch.hostEdgeId ?? opening.hostEdgeId } : null),
                  ...(patch.widthM !== undefined ? { widthM: patch.widthM ?? opening.widthM } : null),
                  ...(patch.heightM !== undefined ? { heightM: patch.heightM ?? opening.heightM } : null),
                  ...(patch.sillHeightM !== undefined
                    ? { sillHeightM: patch.sillHeightM ?? opening.sillHeightM }
                    : null),
                  ...(patch.offsetAlongWallM !== undefined
                    ? { offsetAlongWallM: patch.offsetAlongWallM ?? opening.offsetAlongWallM }
                    : null),
                }
              : opening,
          ),
        }));
        return { ok: true };
      }}
      onDeckInteractionTelemetryChange={(telemetry) => {
        setDeckTelemetry({
          hoveredDeckId: telemetry.hoveredDeckId,
          housePolygonSource: telemetry.housePolygonSource,
          selectedDeckType: telemetry.selectedDeckType,
          dragEligible: telemetry.dragEligible,
          hostEdgeResolvable: telemetry.hostEdgeResolvable,
          relationshipDimensionsAvailable: telemetry.relationshipDimensionsAvailable,
          releaseOutcome: telemetry.releaseOutcome,
          releasePlacement: telemetry.releasePlacement,
          settleVisualState: telemetry.settleVisualState,
          affordanceState: telemetry.affordanceState,
          referenceGuideState: telemetry.referenceGuideState,
          snapState: telemetry.snapState,
          snapMessage: telemetry.snapMessage,
        });
        onDeckInteractionTelemetryChange?.(telemetry);
      }}
    />
  );

  return (
    <div>
      <div data-testid="house-width">{house.footprint.params.widthM}</div>
      <div data-testid="deck-width">{house.decks[0]?.presetRect?.widthM ?? ''}</div>
      <div data-testid="deck-center-offset">{house.decks[0]?.presetRect?.centerOffsetM ?? ''}</div>
      <div data-testid="deck-host-edge">{house.decks[0]?.hostEdgeId ?? ''}</div>
      <div data-testid="deck-primary-host-edge">{house.decks[0]?.primaryHostEdgeId ?? ''}</div>
      <div data-testid="deck-is-attached">{house.decks[0]?.isAttached ? 'true' : 'false'}</div>
      <div data-testid="deck-floating-center-along">{house.decks[0]?.floatingRect?.centerAlongM ?? ''}</div>
      <div data-testid="deck-floating-center-depth">{house.decks[0]?.floatingRect?.centerDepthM ?? ''}</div>
      <div data-testid="deck-outline-0-along">{house.decks[0]?.outline?.[0]?.alongM ?? ''}</div>
      <div data-testid="deck-outline-0-depth">{house.decks[0]?.outline?.[0]?.depthM ?? ''}</div>
      <div data-testid="deck-telemetry-type">{deckTelemetry?.selectedDeckType ?? 'none'}</div>
      <div data-testid="deck-telemetry-house-polygon">{deckTelemetry?.housePolygonSource ?? 'none'}</div>
      <div data-testid="deck-telemetry-drag">{deckTelemetry ? String(deckTelemetry.dragEligible) : 'false'}</div>
      <div data-testid="deck-telemetry-host">{deckTelemetry ? String(deckTelemetry.hostEdgeResolvable) : 'false'}</div>
      <div data-testid="deck-telemetry-relationship">
        {deckTelemetry ? String(deckTelemetry.relationshipDimensionsAvailable) : 'false'}
      </div>
      <div data-testid="deck-telemetry-release-outcome">{deckTelemetry?.releaseOutcome ?? 'none'}</div>
      <div data-testid="deck-telemetry-release-placement">{deckTelemetry?.releasePlacement ?? 'none'}</div>
      <div data-testid="deck-telemetry-settle-visual">{deckTelemetry?.settleVisualState ?? 'none'}</div>
      <div data-testid="deck-telemetry-hovered">{deckTelemetry?.hoveredDeckId ?? 'none'}</div>
      <div data-testid="deck-telemetry-affordance">{deckTelemetry?.affordanceState ?? 'idle'}</div>
      <div data-testid="deck-telemetry-guide">{deckTelemetry?.referenceGuideState ?? 'none'}</div>
      <div data-testid="deck-telemetry-snap">{deckTelemetry?.snapState ?? 'idle'}</div>
      <div data-testid="deck-telemetry-message">{deckTelemetry?.snapMessage ?? 'none'}</div>
      <div data-testid="viewport-pan-x">{String(viewportTransform.panX)}</div>
      <div data-testid="viewport-pan-y">{String(viewportTransform.panY)}</div>
      <div data-testid="viewport-zoom">{String(viewportTransform.zoom)}</div>
      <div data-testid="opening-offset">{house.openings[0]?.offsetAlongWallM ?? ''}</div>
      <div data-testid="footprint-edge-0">
        {(() => {
          const polygon = house.footprint.polygon;
          if (polygon.length < 2) return '';
          const start = polygon[0]!;
          const end = polygon[1]!;
          return String(Math.hypot(Number(end.alongM) - Number(start.alongM), Number(end.depthM) - Number(start.depthM)));
        })()}
      </div>
      {wrapInScrollableAncestor ? (
        <div
          data-testid="deck-drag-scroll-parent"
          style={{ maxHeight: '18rem', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
        >
          <div style={{ minHeight: '48rem', paddingTop: '1rem' }}>{viewport}</div>
        </div>
      ) : (
        viewport
      )}
      {renderSelectionControls ? (
        <>
          <button
            type="button"
            data-testid="select-house-target"
            onClick={() => {
              setSelection({ kind: 'house', targetId: null });
            }}
          >
            Select house
          </button>
          <button
            type="button"
            data-testid="select-deck-target"
            onClick={() => {
              setSelection({ kind: 'deck', targetId: house.decks[0]?.id ?? null });
            }}
          >
            Select deck
          </button>
        </>
      ) : null}
      {pendingDeckCommit ? (
        <button
          type="button"
          data-testid="flush-deck-commit"
          onClick={() => {
            const commit = pendingDeckCommit;
            setPendingDeckCommit(null);
            commit?.();
          }}
        >
          Flush deck commit
        </button>
      ) : null}
    </div>
  );
}

function clickButtonByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => {
    button.click();
  });
}

function getDrawOutlineDiagnostics(container: HTMLElement): DOMStringMap {
  const scroller = container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
  if (!scroller) throw new Error('Missing model-space scroller.');
  return scroller.dataset;
}

function getDrawOutlineDistanceHud(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[aria-label="Draw outline distance HUD"]');
}

function getDrawOutlineLandingMarker(container: HTMLElement): SVGElement | null {
  return container.querySelector('[data-draw-outline-landing-marker="true"]') as SVGElement | null;
}

function getDrawOutlineLockedRadiusMarker(container: HTMLElement): SVGElement | null {
  return container.querySelector('[data-draw-outline-locked-radius="true"]') as SVGElement | null;
}

function expectFiniteDrawOutlineLanding(container: HTMLElement): { alongM: number; depthM: number } {
  const diagnostics = getDrawOutlineDiagnostics(container);
  expect(diagnostics.drawOutlineHasLandingPoint).toBe('true');
  const alongM = Number.parseFloat(diagnostics.drawOutlineLandingAlongM ?? '');
  const depthM = Number.parseFloat(diagnostics.drawOutlineLandingDepthM ?? '');
  expect(Number.isFinite(alongM)).toBe(true);
  expect(Number.isFinite(depthM)).toBe(true);
  const marker = getDrawOutlineLandingMarker(container);
  expect(marker).not.toBeNull();
  expect(marker?.getAttribute('data-draw-outline-landing-along-m')).toBe(diagnostics.drawOutlineLandingAlongM);
  expect(marker?.getAttribute('data-draw-outline-landing-depth-m')).toBe(diagnostics.drawOutlineLandingDepthM);
  return { alongM, depthM };
}

function dispatchEscape(): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
}

function dispatchWindowKey(key: string): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

async function flushAnimationFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 0);
    });
  });
}

async function waitForObjectWorkbenchDeckDragUnlock(container: Element, maxFrames = 12): Promise<void> {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (container.querySelector('[data-model-space-scroller]')?.getAttribute('data-object-workbench-deck-drag-active') === 'false') {
      return;
    }
    await flushAnimationFrame();
  }
}

async function waitForObjectWorkbenchDeckSettleComplete(container: Element, maxFrames = 24): Promise<void> {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const settleVisual = container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent;
    const preview = container.querySelector('[data-object-workbench-preview-shape="deck-1"]');
    if (settleVisual === 'complete' && !preview) return;
    await flushAnimationFrame();
  }
}

function dispatchDrawClick(svg: SVGSVGElement, init: MouseEventInit & { pointerId?: number }): void {
  const pointerId = init.pointerId ?? 1;
  dispatchPointer(svg, 'pointerdown', { ...init, pointerId, button: init.button ?? 0 });
  dispatchPointer(window, 'pointerup', {
    pointerId,
    button: init.button ?? 0,
    clientX: init.clientX,
    clientY: init.clientY,
  });
}

function dispatchWheel(target: EventTarget, init: WheelEventInit): void {
  act(() => {
    target.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

function dispatchGesture(
  target: EventTarget,
  type: 'gesturestart' | 'gesturechange' | 'gestureend' | 'gesturecancel',
  init: { scale?: number; clientX?: number; clientY?: number } = {},
): void {
  act(() => {
    const event = new Event(type, {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'scale', { configurable: true, value: init.scale });
    Object.defineProperty(event, 'clientX', { configurable: true, value: init.clientX });
    Object.defineProperty(event, 'clientY', { configurable: true, value: init.clientY });
    target.dispatchEvent(event);
  });
}

function dispatchTouchPointer(
  target: EventTarget,
  type: string,
  init: MouseEventInit & { pointerId: number; pointerType?: string },
): void {
  act(() => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    Object.defineProperty(event, 'pointerId', { configurable: true, value: init.pointerId });
    Object.defineProperty(event, 'pointerType', { configurable: true, value: init.pointerType ?? 'touch' });
    target.dispatchEvent(event);
  });
}

function installSvgPointMock(svg: SVGSVGElement): void {
  Object.defineProperty(svg, 'getScreenCTM', {
    configurable: true,
    value: () => ({
      inverse: () => ({}),
    }),
  });
  Object.defineProperty(svg, 'createSVGPoint', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      matrixTransform(this: { x: number; y: number }) {
        return { x: this.x, y: this.y };
      },
    }),
  });
}

function installProjectedSvgPointMock(
  svg: SVGSVGElement,
  options: { xScale?: number; yScale?: number; xOffset?: number; yOffset?: number } = {},
): void {
  const xScale = options.xScale ?? 0.5;
  const yScale = options.yScale ?? 0.25;
  const xOffset = options.xOffset ?? 10;
  const yOffset = options.yOffset ?? 20;
  Object.defineProperty(svg, 'getScreenCTM', {
    configurable: true,
    value: () => ({
      inverse: () => ({}),
    }),
  });
  Object.defineProperty(svg, 'createSVGPoint', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      matrixTransform(this: { x: number; y: number }) {
        return {
          x: (this.x - xOffset) * xScale,
          y: (this.y - yOffset) * yScale,
        };
      },
    }),
  });
}

function makeRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function snapshotRect(rect: DOMRect): { top: number; left: number; width: number; height: number } {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function installScrollableAncestorMock(container: HTMLElement, initialScrollTop = 80): {
  scrollParent: HTMLElement;
  scroller: HTMLElement;
  getScrollTop: () => number;
  getScrollerRect: () => DOMRect;
} {
  const scrollParent = container.querySelector('[data-testid="deck-drag-scroll-parent"]') as HTMLElement | null;
  const scroller = container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
  if (!scrollParent || !scroller) throw new Error('Missing scrollable ancestor fixture.');

  let scrollTop = initialScrollTop;
  let scrollLeft = 0;
  Object.defineProperty(scrollParent, 'clientHeight', { configurable: true, value: 280 });
  Object.defineProperty(scrollParent, 'clientWidth', { configurable: true, value: 720 });
  Object.defineProperty(scrollParent, 'scrollHeight', { configurable: true, value: 1600 });
  Object.defineProperty(scrollParent, 'scrollWidth', { configurable: true, value: 720 });
  Object.defineProperty(scrollParent, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Number(value);
    },
  });
  Object.defineProperty(scrollParent, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = Number(value);
    },
  });
  Object.defineProperty(scrollParent, 'getBoundingClientRect', {
    configurable: true,
    value: () => makeRect(0, 0, 720, 280),
  });
  Object.defineProperty(scroller, 'getBoundingClientRect', {
    configurable: true,
    value: () => makeRect(16, 40 - scrollTop, 560, 240),
  });

  return {
    scrollParent,
    scroller,
    getScrollTop: () => scrollTop,
    getScrollerRect: () => scroller.getBoundingClientRect(),
  };
}

function expectedFitForTargetRect(input: {
  scrollerWidth: number;
  scrollerHeight: number;
  target: { x: number; y: number; width: number; height: number };
}): { zoom: number; panX: number; panY: number } {
  const zoom = Math.min(Math.max(Math.min((input.scrollerWidth - 48) / input.target.width, (input.scrollerHeight - 48) / input.target.height), 0.25), 4);
  return {
    zoom,
    panX: input.scrollerWidth / 2 - (input.target.x + input.target.width / 2) * zoom,
    panY: input.scrollerHeight / 2 - (input.target.y + input.target.height / 2) * zoom,
  };
}

describe('ModelSpaceViewport', () => {
  it('renders plan controls for the live model-space configurator', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithHouseContext();
    const assembly = buildAssemblyModel({
      id: drawing.id,
      label: 'M1 - Pitched - 6m x 3m',
      moduleIndex: 0,
      moduleInput: drawing.input,
      moduleResult: drawing.result,
      planModel,
      sectionModel: drawing.sectionModel,
    });
    const geometryPlan = makeGeometryPlanFromPlanModel(planModel);

    const markup = renderToStaticMarkup(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: assembly.id,
          moduleLabel: assembly.label,
          planModel,
          geometryPlan,
          geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
          canEditHouseFootprint: assembly.capabilities.canEditHouseFootprint,
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('aria-label="Plan model space viewport"');
    expect(markup).toContain('data-draw-outline-active="false"');
    expect(markup).toContain('data-draw-outline-state="inactive"');
    expect(markup).toContain('data-draw-outline-point-count="0"');
    expect(markup).toContain('data-draw-outline-preview-kind="none"');
    expect(markup).toContain('data-draw-outline-angle-mode="none"');
    expect(markup).toContain('data-model-space-gesture="idle"');
    expect(markup).toContain('data-model-space-active-touch-count="0"');
    expect(markup).toContain('data-model-space-pinch-active="false"');
    expect(markup).toContain('data-model-space-pinch-source="none"');
    expect(markup).toContain('data-model-space-auto-fit-key="plan:ready"');
    expect(markup).toContain('data-model-space-auto-fit-ready="true"');
    expect(markup).toContain('data-native-selection-suppressed="true"');
    expect(markup).toContain('data-draw-outline-can-redraw="false"');
    expect(markup).toContain('data-draw-outline-redraw-active="false"');
    expect(markup).not.toContain('aria-label="Draw outline status"');
    expect(markup).toContain('Fit view');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:lengthA"');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:spanA"');
    expect(markup).toContain('data-editable-field-id="plan:lengthA"');
    expect(markup).toContain('data-editable-field-id="plan:spanA"');
    expect(markup).not.toContain('data-footprint-edge=');
    expect(markup).not.toContain('data-footprint-resize-edge-hit=');
    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).toContain('data-house-plan-line="attachment_target"');
    expect(markup).not.toContain('Live plan viewport');
    expect(markup).not.toContain('House footprint mode');
    expect(markup).not.toContain('House footprint');
    expect(markup).not.toContain('House type');
    expect(markup).not.toContain('Rotate -90');
  });

  it('renders house-first plan overlays alongside pergola graphics in house display mode by default', () => {
    const drawing = makeDrawingModule();
    const baseHouse = makeHouseFirstHouse();
    const deck = makeHouseFirstDeck();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const house = makeHouseFirstHouse({
      decks: [
        {
          ...deck,
          hostEdgeId: resolvedDeck.hostEdgeId,
          presetRect: resolvedDeck.presetRect,
          outline: resolvedDeck.outline,
        },
      ],
    });
    const planModel = makePlanModelWithHouseContext();
    const geometryPlan = makeGeometryPlanFromPlanModel(planModel, house);

    const markup = renderToStaticMarkup(
      <TestModelSpaceViewport
        view="plan"
        objectWorkbenchDisplayFamily="house_forms"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel,
          geometryPlan,
          geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
          canEditHouseFootprint: true,
          objectWorkbenchOverlayInput: makeObjectWorkbenchOverlayInputFromHouse({
            drawing,
            house,
            planModel,
            selection: { kind: 'footprint', targetId: 'house-main' },
          }),
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onSelectObjectWorkbenchTarget={() => undefined}
        onCommitHouseFormFootprintDimension={() => ({ ok: true })}
        onCommitDeckDimension={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).toContain('data-object-workbench-shape-hit="footprint:house-main"');
    expect(markup).toContain('data-object-workbench-shape-hit="deck:deck-1"');
    expect(markup).toContain('data-editable-field-id="house-main:widthM"');
    expect(markup).toContain('data-plan-primary-fill="true"');
    expect(markup).not.toContain('data-editable-field-id="plan:lengthA"');
    expect(markup).not.toContain('data-plan-resize-handle-hit=');
    expect(markup).toContain('modulePlanRafter');
    expect(markup).not.toContain('data-sheet-hover-target="pergola"');
  });

  it('keeps house-mode semantic house placement aligned with geometry-backed pergolas for rear, front, and side contexts', () => {
    const drawing = makeDrawingModule();
    type PlacementCase = {
      label: string;
      planModel: ModulePlanModel;
      axis: 'x' | 'y';
      comparison: 'less' | 'greater';
    };

    const cases: PlacementCase[] = [
      {
        label: 'rear',
        planModel: makePlanModelWithSemanticHouseBoundary([
          { x: 0, y: -1.8 },
          { x: 6, y: -1.8 },
          { x: 6, y: 0 },
          { x: 0, y: 0 },
        ]),
        axis: 'y',
        comparison: 'less',
      },
      {
        label: 'front',
        planModel: makePlanModelWithSemanticHouseBoundary([
          { x: 0, y: 3 },
          { x: 6, y: 3 },
          { x: 6, y: 4.8 },
          { x: 0, y: 4.8 },
        ]),
        axis: 'y',
        comparison: 'greater',
      },
      {
        label: 'side',
        planModel: makePlanModelWithSemanticHouseBoundary([
          { x: -1.8, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 3 },
          { x: -1.8, y: 3 },
        ]),
        axis: 'x',
        comparison: 'greater',
      },
    ];

    for (const testCase of cases) {
      const geometryPlan = makeGeometryPlanFromPlanModel(testCase.planModel);
      const rendered = renderIntoDocument(
        <TestModelSpaceViewport
          view="plan"
          objectWorkbenchDisplayFamily="house_forms"
          status="ready"
          planModel={testCase.planModel}
          sectionModel={drawing.sectionModel}
          planViewModel={buildPlanViewModel({
            moduleId: drawing.id,
            moduleLabel: 'Module 1',
            planModel: testCase.planModel,
            geometryPlan,
            geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
            pergolaRenderSource: 'geometry',
            pergolaRenderStatus: 'geometry_ready',
          })}
          viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
          onViewportTransformChange={() => undefined}
          editableFields={makePlanEditableFields()}
          onCommitField={() => ({ ok: true })}
          onCommitFootprintEdit={() => ({ ok: true })}
        />,
      );

      const houseSurface = rendered.container.querySelector('[data-house-plan-surface="footprint"]');
      const pergolaFill = rendered.container.querySelector('[data-plan-primary-fill="true"]');
      if (!houseSurface || !pergolaFill) {
        throw new Error(`Missing house-mode plan nodes for ${testCase.label} case.`);
      }

      if (testCase.axis === 'x') {
        const houseCentroid = polygonCentroidX(houseSurface);
        const pergolaCentroid = polygonCentroidX(pergolaFill);
        if (testCase.comparison === 'less') {
          expect(houseCentroid).toBeLessThan(pergolaCentroid);
        } else {
          expect(houseCentroid).toBeGreaterThan(pergolaCentroid);
        }
      } else {
        const houseCentroid = polygonCentroidY(houseSurface);
        const pergolaCentroid = polygonCentroidY(pergolaFill);
        if (testCase.comparison === 'less') {
          expect(houseCentroid).toBeLessThan(pergolaCentroid);
        } else {
          expect(houseCentroid).toBeGreaterThan(pergolaCentroid);
        }
      }

      rendered.unmount();
    }
  });

  it('keeps the house-first footprint overlay on the same world side of the pergola as the semantic house surface in house mode', () => {
    const drawing = makeDrawingModule();
    const house = makeHouseFirstHouse();
    const planModel = makePlanModelWithHouseContext();
    const geometryPlan = makeGeometryPlanFromPlanModel(planModel, house);
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        objectWorkbenchDisplayFamily="house_forms"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel,
          geometryPlan,
          geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
          canEditHouseFootprint: true,
          objectWorkbenchOverlayInput: makeObjectWorkbenchOverlayInputFromHouse({
            drawing,
            house,
            planModel,
            selection: { kind: 'deck', targetId: 'deck-1' },
          }),
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onSelectObjectWorkbenchTarget={() => undefined}
        onCommitHouseFormFootprintDimension={() => ({ ok: true })}
        onCommitDeckDimension={() => ({ ok: true })}
      />,
    );

    const houseSurface = rendered.container.querySelector('[data-house-plan-surface="footprint"]');
    const footprintShape = rendered.container.querySelector('[data-object-workbench-shape="footprint:house-main"]');
    const pergolaFill = rendered.container.querySelector('[data-plan-primary-fill="true"]');
    if (!houseSurface || !footprintShape || !pergolaFill) {
      throw new Error('Missing merged house-mode footprint alignment nodes.');
    }

    const houseCentroidY = polygonCentroidY(houseSurface);
    const footprintCentroidY = polygonCentroidY(footprintShape);
    const pergolaCentroidY = polygonCentroidY(pergolaFill);

    expect(houseCentroidY).toBeLessThan(pergolaCentroidY);
    expect(footprintCentroidY).toBeLessThan(pergolaCentroidY);

    rendered.unmount();
  });

  it('keeps projection-led focus while world bounds include true house coordinates in house mode', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithLargeHouseContext();
    const geometryPlan = makeGeometryPlanFixture();
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        objectWorkbenchDisplayFamily="house_forms"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel,
          geometryPlan,
          geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]');
    if (!svg) throw new Error('Missing model-space plan svg.');

    const worldBox = parseViewBoxAttr(svg.getAttribute('data-model-space-world-box'));
    const focusBox = parseViewBoxAttr(svg.getAttribute('data-model-space-focus-box'));

    expect(worldBox.x).toBeLessThan(-700);
    expect(worldBox.y).toBeLessThan(-500);
    expect(focusBox.y).toBeGreaterThan(worldBox.y);
    expect(focusBox.height).toBeLessThan(worldBox.height);

    rendered.unmount();
  });

  it('renders model-space pergolas from the geometry-backed plan payload instead of legacy rafter reconstruction', () => {
    const drawing = makeDrawingModule();
    const geometryPlan = makeGeometryPlanFixture();
    const legacyPlanModel: ModulePlanModel = {
      ...makePlanModelWithHouseContext(),
      rafterPositionsA: [0.6, 1.4, 2.2, 3.0, 3.8, 4.6, 5.4],
      rafterCountA: 7,
      drawingRotationQuarterTurns: 0,
    };

    const markup = renderToStaticMarkup(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={legacyPlanModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel: legacyPlanModel,
          geometryPlan,
          geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('data-plan-render-source="geometry"');
    expect(markup).toContain('data-plan-render-status="geometry_ready"');
    expect(markup).toContain('data-plan-primary-fill="true"');
    expect(markup).toContain('data-plan-member-id="rafter-a"');
    expect(markup).toContain('data-plan-member-id="rafter-b"');
    expect(markup).toContain('data-plan-member-id="joiner-run-1"');
    expect(markup).toContain('data-plan-member-centerline-mm="800,220,800,2840"');
    expect(markup).toContain('data-plan-member-centerline-mm="2100,220,2100,2840"');
    expect(markup).toContain('data-plan-member-centerline-mm="4500,220,4500,2840"');
    expect(markup).toContain('data-plan-attachment-edge="geometry"');
    expect(markup).toContain('data-plan-fall-direction="0,1"');
  });

  it('keeps geometry-backed model-space pergola plans unrotated by sheet quarter-turns', () => {
    const drawing = makeDrawingModule();
    const geometryPlan = makeGeometryPlanFixture();

    const turnCases = [
      { turns: 0 as const },
      { turns: 1 as const },
      { turns: 2 as const },
      { turns: 3 as const },
    ];

    for (const testCase of turnCases) {
      const planModel: ModulePlanModel = {
        ...makePlanModelWithHouseContext(),
        drawingRotationQuarterTurns: testCase.turns,
      };

      const markup = renderToStaticMarkup(
        <TestModelSpaceViewport
          view="plan"
          status="ready"
          planModel={planModel}
          sectionModel={drawing.sectionModel}
          planViewModel={buildPlanViewModel({
            moduleId: drawing.id,
            moduleLabel: 'Module 1',
            planModel,
            geometryPlan,
            geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
            pergolaRenderSource: 'geometry',
            pergolaRenderStatus: 'geometry_ready',
          })}
          viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
          onViewportTransformChange={() => undefined}
          editableFields={makePlanEditableFields()}
          onCommitField={() => ({ ok: true })}
          onCommitFootprintEdit={() => ({ ok: true })}
        />,
      );

      expect(markup).toContain('data-plan-render-source="geometry"');
      expect(markup).not.toContain('rotate(90 ');
      expect(markup).not.toContain('rotate(180 ');
      expect(markup).not.toContain('rotate(270 ');
    }
  });

  it('hides pergola graphics in house display mode when pergola visibility is turned off', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithHouseContext();
    const geometryPlan = makeGeometryPlanFromPlanModel(planModel);

    const markup = renderToStaticMarkup(
      <TestModelSpaceViewport
        view="plan"
        objectWorkbenchDisplayFamily="house_forms"
        visibility={{
          house: true,
          pergolas: false,
          decks: true,
          openings: true,
        }}
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel,
          geometryPlan,
          geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
          canEditHouseFootprint: true,
          objectWorkbenchOverlayInput: makeObjectWorkbenchOverlayInputFromHouse({
            drawing,
            house: makeHouseFirstHouse(),
            planModel,
            selection: { kind: 'house', targetId: null },
          }),
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
      />,
    );

    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).not.toContain('data-plan-primary-fill="true"');
    expect(markup).not.toContain('modulePlanRafter');
  });

  it('renders custom footprint vertices and edge insertion targets in model space', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseFootprintMode: 'custom_polygon',
      houseFootprintPolygon: [
        { alongM: '0', depthM: '2.4' },
        { alongM: '6', depthM: '2.4' },
        { alongM: '6', depthM: '0' },
        { alongM: '3', depthM: '0' },
        { alongM: '3', depthM: '1.2' },
        { alongM: '0', depthM: '1.2' },
      ],
    };
    const geometryPlan = makeGeometryPlanFromPlanModel(planModel);

    const markup = renderToStaticMarkup(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel,
          geometryPlan,
          geometryTopProjection: makeTopProjectionFromGeometryPlan(geometryPlan),
          pergolaRenderSource: 'geometry',
          pergolaRenderStatus: 'geometry_ready',
          canEditHouseFootprint: true,
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('data-footprint-custom-vertex="0"');
    expect(markup).toContain('data-footprint-custom-vertex="5"');
    expect(markup).toContain('data-footprint-custom-edge-hit="0"');
    expect(markup).not.toContain('data-footprint-resize-edge-hit="bandDepth"');
  });

  it('renders section mode as a read-only model-space drawing', () => {
    const drawing = makeDrawingModule();

    const markup = renderToStaticMarkup(
      <TestModelSpaceViewport
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Section model space viewport"');
    expect(markup).toContain('aria-label="Module section view"');
    expect(markup).not.toContain('data-plan-resize-handle-hit=');
    expect(markup).not.toContain('Draw house outline controls');
  });

  it('renders a house-mode section placeholder instead of the pergola section drawing', () => {
    const drawing = makeDrawingModule();

    const markup = renderToStaticMarkup(
      <TestModelSpaceViewport
        view="section"
        objectWorkbenchDisplayFamily="house_forms"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
      />,
    );

    expect(markup).toContain('House mode section view is not available yet.');
    expect(markup).not.toContain('aria-label="Module section view"');
  });

  it('allows model-space zoom below 100 percent', () => {
    const drawing = makeDrawingModule();
    const transform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={transform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    clickButtonByText(rendered.container, '-');

    expect(onViewportTransformChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 0.9 }));

    rendered.unmount();
  });

  it('zooms around the wheel pointer anchor with normalized trackpad input', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchWheel(resizeHit, { ctrlKey: true, deltaY: -120, clientX: 100, clientY: 80 });

    const next = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(next?.zoom).toBeGreaterThan(viewportTransform.zoom);
    expect(next?.zoom).toBeCloseTo(Math.exp(120 * 0.0036), 6);
    expect(next?.panX).toBeLessThan(viewportTransform.panX);
    expect(next?.panY).toBeLessThan(viewportTransform.panY);
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpaceGesture).toBe('wheel-zoom');
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpacePinchSource).toBe('wheel');

    rendered.unmount();
  });

  it('zooms the model-space viewport with plain wheel input', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = { zoom: 1.25, panX: 20, panY: -10 };
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchWheel(resizeHit, { deltaX: 12, deltaY: 30, clientX: 100, clientY: 80 });

    const next = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(next?.zoom).toBeLessThan(viewportTransform.zoom);
    expect(next?.panX).not.toBe(viewportTransform.panX);
    expect(next?.panY).not.toBe(viewportTransform.panY);
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpaceGesture).toBe('wheel-zoom');
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpacePinchSource).toBe('wheel');

    rendered.unmount();
  });

  it('zooms the section model-space viewport with plain wheel input', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');
    dispatchWheel(scroller, { deltaY: -60, clientX: 120, clientY: 90 });

    const next = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(next?.zoom).toBeGreaterThan(viewportTransform.zoom);
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpaceGesture).toBe('wheel-zoom');
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpacePinchSource).toBe('wheel');

    rendered.unmount();
  });

  it('zooms with WebKit gesture events over drawing geometry', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchGesture(resizeHit, 'gesturestart', { clientX: 120, clientY: 80 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'trackpad-pinch',
      modelSpacePinchActive: 'true',
      modelSpacePinchSource: 'webkit-gesture',
    });

    dispatchGesture(resizeHit, 'gesturechange', { scale: 1.5, clientX: 120, clientY: 80 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 1.5,
        panX: -60,
        panY: -40,
      }),
    );

    dispatchGesture(resizeHit, 'gestureend', { clientX: 120, clientY: 80 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'idle',
      modelSpacePinchActive: 'false',
      modelSpacePinchSource: 'none',
    });

    rendered.unmount();
  });

  it('ignores WebKit gesture events from controls and draw inputs', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );
    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const zoomOut = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === '-');
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!zoomOut || !svg) throw new Error('Missing viewport controls.');
    installSvgPointMock(svg);
    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('2');
    const distanceHud = getDrawOutlineDistanceHud(rendered.container);
    if (!distanceHud) throw new Error('Missing distance HUD.');

    dispatchGesture(zoomOut, 'gesturestart', { clientX: 20, clientY: 20 });
    dispatchGesture(zoomOut, 'gesturechange', { scale: 1.4, clientX: 20, clientY: 20 });
    dispatchGesture(distanceHud, 'gesturestart', { clientX: 20, clientY: 20 });
    dispatchGesture(distanceHud, 'gesturechange', { scale: 1.4, clientX: 20, clientY: 20 });

    expect(onViewportTransformChange).not.toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'idle',
      modelSpacePinchActive: 'false',
      modelSpacePinchSource: 'none',
    });

    rendered.unmount();
  });

  it('ignores viewport wheel navigation from controls and draw inputs', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );
    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const zoomOut = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === '-');
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!zoomOut || !svg) throw new Error('Missing viewport controls.');
    installSvgPointMock(svg);
    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('2');
    const distanceHud = getDrawOutlineDistanceHud(rendered.container);
    if (!distanceHud) throw new Error('Missing distance HUD.');

    dispatchWheel(zoomOut, { ctrlKey: true, deltaY: -120, clientX: 20, clientY: 20 });
    dispatchWheel(distanceHud, { deltaY: 30, clientX: 20, clientY: 20 });

    expect(onViewportTransformChange).not.toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpaceGesture).toBe('idle');

    rendered.unmount();
  });

  it('pinch zooms and pans with two touch pointers', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');
    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    installSvgPointMock(svg);
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchTouchPointer(resizeHit, 'pointerdown', { pointerId: 21, button: 0, clientX: 100, clientY: 100 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceActiveTouchCount: '1',
      modelSpacePinchActive: 'false',
    });
    dispatchTouchPointer(resizeHit, 'pointerdown', { pointerId: 22, button: 0, clientX: 200, clientY: 100 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'pinch-zoom',
      modelSpaceActiveTouchCount: '2',
      modelSpacePinchActive: 'true',
      modelSpacePinchSource: 'touch-pointer',
    });

    dispatchTouchPointer(window, 'pointermove', { pointerId: 22, button: 0, clientX: 240, clientY: 100 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 1.4,
        panX: -40,
        panY: -40,
      }),
    );

    dispatchTouchPointer(window, 'pointermove', { pointerId: 22, button: 0, clientX: 170, clientY: 100 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 0.7,
        panX: 30,
        panY: 30,
      }),
    );

    dispatchTouchPointer(window, 'pointercancel', { pointerId: 22, button: 0, clientX: 170, clientY: 100 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'idle',
      modelSpaceActiveTouchCount: '0',
      modelSpacePinchActive: 'false',
      modelSpacePinchSource: 'none',
    });

    rendered.unmount();
  });

  it('keeps one-touch plan resize drag working on edit hit targets', () => {
    const drawing = makeDrawingModule();
    const onCommitField = vi.fn(() => ({ ok: true }));
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={onCommitField}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    installSvgPointMock(svg);
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');

    dispatchTouchPointer(resizeHit, 'pointerdown', { pointerId: 25, button: 0, clientX: 45, clientY: 28 });
    dispatchTouchPointer(window, 'pointermove', { pointerId: 25, button: 0, clientX: 65, clientY: 28 });
    dispatchTouchPointer(window, 'pointerup', { pointerId: 25, button: 0, clientX: 65, clientY: 28 });

    expect(onCommitField).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan:lengthA' }), expect.any(String));
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceActiveTouchCount: '0',
      modelSpacePinchActive: 'false',
    });

    rendered.unmount();
  });

  it('pinch navigation leaves draw outline active without placing or committing points', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    installSvgPointMock(svg);
    dispatchTouchPointer(svg, 'pointerdown', { pointerId: 23, button: 0, clientX: 100, clientY: 100 });
    dispatchTouchPointer(svg, 'pointerdown', { pointerId: 24, button: 0, clientX: 200, clientY: 100 });
    dispatchTouchPointer(window, 'pointermove', { pointerId: 24, button: 0, clientX: 230, clientY: 110 });
    dispatchTouchPointer(window, 'pointerup', { pointerId: 24, button: 0, clientX: 230, clientY: 110 });

    expect(onViewportTransformChange).toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      modelSpacePinchActive: 'false',
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('fits and centers the model-space drawing on initial render and Fit view', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const focusTargetRect = { x: 140, y: 90, width: 260, height: 180 };
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 12000, 9000);
      if (this instanceof Element && this.getAttribute('data-model-space-focus-target') === 'true') {
        return makeRect(focusTargetRect.x, focusTargetRect.y, focusTargetRect.width, focusTargetRect.height);
      }
      return makeRect(0, 0, 0, 0);
    });

    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithLargeHouseContext()}
        sectionModel={drawing.sectionModel}
        fitViewKey="module-1:plan"
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();
    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    const focusTarget = rendered.container.querySelector('[data-model-space-focus-target="true"]');
    expect(svg).not.toBeNull();
    expect(focusTarget).not.toBeNull();
    const expectedFit = expectedFitForTargetRect({
      scrollerWidth: 600,
      scrollerHeight: 400,
      target: focusTargetRect,
    });
    const initialFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(initialFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(initialFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(initialFit?.panY).toBeCloseTo(expectedFit.panY, 3);
    expect(initialFit?.zoom).toBeGreaterThan(0.25);

    onViewportTransformChange.mockClear();
    clickButtonByText(rendered.container, 'Fit view');

    const resetFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(resetFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(resetFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(resetFit?.panY).toBeCloseTo(expectedFit.panY, 3);

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('falls back to model-space focus metadata when the focus target cannot be measured', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 12000, 9000);
      return makeRect(0, 0, 0, 0);
    });

    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithLargeHouseContext()}
        sectionModel={drawing.sectionModel}
        fitViewKey="module-1:plan"
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    const target = {
      x: 0,
      y: 0,
      width: Number.parseFloat(svg.getAttribute('width') ?? '0'),
      height: Number.parseFloat(svg.getAttribute('height') ?? '0'),
    };
    const expectedFit = expectedFitForTargetRect({
      scrollerWidth: 600,
      scrollerHeight: 400,
      target,
    });
    const initialFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(initialFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(initialFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(initialFit?.panY).toBeCloseTo(expectedFit.panY, 3);

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('keeps the current view through model edits and auto-fits only when the viewport context changes', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (
      planModel: ModulePlanModel | null | undefined = drawing.planModel,
      fitViewKey = 'module-1:plan',
    ) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey={fitViewKey}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    clickButtonByText(rendered.container, '-');
    expect(onViewportTransformChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 0.9 }));

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport(drawing.planModel));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport({ ...drawing.planModel!, lengthA: drawing.planModel!.lengthA + 1 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport({ ...drawing.planModel!, lengthA: drawing.planModel!.lengthA + 2 }, 'module-2:plan'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('auto-fits once when drawable model-space content becomes available', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (planModel: ModulePlanModel | null | undefined) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey="module-1:plan"
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport(null));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'module-1:plan:empty',
      modelSpaceAutoFitReady: 'false',
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    rendered.rerender(renderViewport(drawing.planModel));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'module-1:plan:ready',
      modelSpaceAutoFitReady: 'true',
    });
    expect(onViewportTransformChange).toHaveBeenCalledTimes(1);

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport({ ...drawing.planModel!, lengthA: drawing.planModel!.lengthA + 1 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('skips first-visit auto-fit when the current surface already has a persisted transform', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });

    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey="house:0:plan"
        autoFitOnReady={false}
        viewportTransform={{ zoom: 1.35, panX: 48, panY: -26 }}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'house:0:plan:ready',
      modelSpaceAutoFitReady: 'true',
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('auto-fits again when switching between model-space plan and section views', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (view: 'plan' | 'section') => (
      <TestModelSpaceViewport
        view={view}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey={`module-1:${view}`}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport('plan'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport('section'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'module-1:section:ready',
      modelSpaceAutoFitReady: 'true',
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('starts draw outline only in the model-space plan view and cancel restores the previous footprint', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithHouseContext();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());

    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();

    rendered.rerender(renderViewport(1));

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineHasPendingPoint: 'false',
      drawOutlinePreviewKind: 'none',
      drawOutlineCloseReady: 'false',
      drawOutlineCloseHovered: 'false',
      drawOutlineHasLandingPoint: 'false',
      drawOutlineGesture: 'idle',
      drawOutlinePanThresholdPx: '5',
      drawOutlineAngleMode: 'relative',
      drawOutlineHasError: 'false',
    });
    expect(getDrawOutlineDistanceHud(rendered.container)).toBeNull();
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-edge]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-resize-edge-hit]')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Draw house outline controls"]')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Draw outline status"]')).toBeNull();

    dispatchEscape();

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
      drawOutlinePointCount: '0',
      drawOutlineHasLandingPoint: 'false',
      drawOutlineAngleMode: 'none',
    });
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-edge]')).toBeNull();
    expect(getDrawOutlineDistanceHud(rendered.container)).toBeNull();

    rendered.unmount();
  });

  it('starts redraw for an existing custom outline as a draft and cancel restores the persisted polygon', () => {
    const drawing = makeDrawingModule();
    const planModel = makeCustomPolygonPlanModel();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />,
    );

    expect(rendered.container.textContent).toContain('Redraw outline');
    expect(rendered.container.querySelector('[data-draw-outline-redraw-entry="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineCanRedraw: 'true',
      drawOutlineRedrawActive: 'false',
      drawOutlinePointCount: '0',
    });

    clickButtonByText(rendered.container, 'Redraw outline');

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.textContent).not.toContain('Redraw outline');
    expect(rendered.container.querySelector('[data-draw-outline-redraw-entry="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineCanRedraw: 'false',
      drawOutlineRedrawActive: 'true',
    });

    dispatchEscape();

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Redraw outline');
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
      drawOutlineCanRedraw: 'true',
      drawOutlineRedrawActive: 'false',
    });

    rendered.unmount();
  });

  it('commits a replacement custom polygon only after a redraw outline closes successfully', async () => {
    const drawing = makeDrawingModule();
    const planModel = makeCustomPolygonPlanModel();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />,
    );

    clickButtonByText(rendered.container, 'Redraw outline');

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });

    await act(async () => {
      const closeHit = rendered.container.querySelector('[data-footprint-custom-close-hit="0"]');
      if (!closeHit) throw new Error('Missing close-ready start hit target.');
      dispatchPointer(closeHit, 'pointerdown', { pointerId: 91, button: 0, clientX: 45, clientY: 28 });
      dispatchPointer(window, 'pointerup', { pointerId: 91, button: 0, clientX: 45, clientY: 28 });
      await Promise.resolve();
    });

    expect(commitFootprintEdit).toHaveBeenCalledTimes(1);
    expect(commitFootprintEdit).toHaveBeenCalledWith({
      type: 'custom_polygon',
      polygon: expect.arrayContaining([
        expect.objectContaining({ alongM: expect.any(String), depthM: expect.any(String) }),
      ]),
    });
    const firstCommit = (commitFootprintEdit.mock.calls as unknown as Array<[{ type: 'custom_polygon'; polygon: unknown[] }]>)[0]?.[0];
    expect(firstCommit?.polygon).toHaveLength(3);
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'inactive',
      drawOutlineRedrawActive: 'false',
    });

    rendered.unmount();
  });

  it('keeps Fit view as a camera-only action for existing custom outlines', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const focusTargetRect = { x: 90, y: 70, width: 240, height: 170 };
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 12000, 9000);
      if (this instanceof Element && this.getAttribute('data-model-space-focus-target') === 'true') {
        return makeRect(focusTargetRect.x, focusTargetRect.y, focusTargetRect.width, focusTargetRect.height);
      }
      return makeRect(0, 0, 0, 0);
    });
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makeCustomPolygonPlanModel()}
        sectionModel={drawing.sectionModel}
        fitViewKey="module-1:plan"
        viewportTransform={{ zoom: 1.5, panX: 30, panY: -20 }}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    onViewportTransformChange.mockClear();

    clickButtonByText(rendered.container, 'Fit view');

    expect(onViewportTransformChange).toHaveBeenCalled();
    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineCanRedraw: 'true',
    });

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('escape exits draw outline without committing and restores the previous footprint', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithHouseContext();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
    });
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).toBeNull();

    dispatchEscape();

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
    });
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();

    rendered.unmount();
  });

  it('auto-cancels an unfinished draw outline when leaving the plan view', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (view: 'plan' | 'section', drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view={view}
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport('plan'));
    rendered.rerender(renderViewport('plan', 1));

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
    });

    rendered.rerender(renderViewport('section', 0));
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
    });

    rendered.rerender(renderViewport('plan', 0));
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('anchors the draw outline distance HUD to the latest rendered custom vertex', async () => {
    const drawing = makeDrawingModule();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.getAttribute('aria-label') === 'Draw outline distance HUD') return makeRect(0, 0, 112, 60);
      if (this instanceof Element && this.getAttribute('data-footprint-custom-vertex') === '0') return makeRect(500, 180, 10, 10);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('2');
    await act(async () => {
      await Promise.resolve();
    });

    const hud = getDrawOutlineDistanceHud(rendered.container);
    expect(hud?.getAttribute('data-draw-distance-hud-anchor')).toBe('vertex');
    expect(Number.parseFloat(hud?.style.left ?? '')).toBeGreaterThanOrEqual(12);
    expect(Number.parseFloat(hud?.style.left ?? '')).toBeLessThanOrEqual(476);
    expect(Number.parseFloat(hud?.style.top ?? '')).toBeGreaterThanOrEqual(12);
    expect(Number.parseFloat(hud?.style.top ?? '')).toBeLessThanOrEqual(328);

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('sets draw outline landing diagnostics before placing the first point', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointermove', { clientX: 45, clientY: 28 });
    const landing = expectFiniteDrawOutlineLanding(rendered.container);
    expect(landing.alongM).toBeCloseTo(3.75, 3);
    expect(landing.depthM).toBeCloseTo(-2.333, 3);
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlinePreviewKind: 'none',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex]')).toBeNull();

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineHasLandingPoint: 'true',
    });
    const markerCircle = getDrawOutlineLandingMarker(rendered.container)?.querySelector('circle');
    const latestVertex = rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]') as SVGCircleElement | null;
    expect(latestVertex).not.toBeNull();
    expect(Number.parseFloat(latestVertex?.getAttribute('cx') ?? '')).toBeCloseTo(Number.parseFloat(markerCircle?.getAttribute('cx') ?? ''), 2);
    expect(Number.parseFloat(latestVertex?.getAttribute('cy') ?? '')).toBeCloseTo(Number.parseFloat(markerCircle?.getAttribute('cy') ?? ''), 2);
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    dispatchPointer(svg, 'pointerout');
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlinePointCount: '1',
      drawOutlineHasLandingPoint: 'false',
    });
    expect(getDrawOutlineLandingMarker(rendered.container)).toBeNull();

    rendered.unmount();
  });

  it('places draw outline points from model-space scroller space outside the pergola outline', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!scroller || !svg) throw new Error('Missing model-space scroller or SVG.');
    installSvgPointMock(svg);

    dispatchPointer(scroller, 'pointermove', { clientX: 20, clientY: -12 });
    const landing = expectFiniteDrawOutlineLanding(rendered.container);
    expect(landing.alongM).toBeCloseTo(1.667, 3);
    expect(landing.depthM).toBeCloseTo(1, 3);
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineDraftSource: 'active-draft',
    });

    dispatchPointer(scroller, 'pointerdown', { pointerId: 31, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointerup', { pointerId: 31, button: 0, clientX: 20, clientY: -12 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineDraftSource: 'active-draft',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-edge]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-resize-edge-hit]')).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('does not place draw outline points from viewport or draw controls', () => {
    const drawing = makeDrawingModule();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);
    const fitViewButton = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Fit view');
    if (!fitViewButton) throw new Error('Missing fit view button.');

    dispatchPointer(fitViewButton, 'pointerdown', { pointerId: 41, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointerup', { pointerId: 41, button: 0, clientX: 20, clientY: -12 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'idle',
    });

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('2');
    const distanceHud = getDrawOutlineDistanceHud(rendered.container);
    if (!distanceHud) throw new Error('Missing draw outline distance HUD.');
    dispatchPointer(distanceHud, 'pointerdown', { pointerId: 42, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointerup', { pointerId: 42, button: 0, clientX: 20, clientY: -12 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineGesture: 'idle',
    });

    rendered.unmount();
  });

  it('defers draw outline point placement until pointer up', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { pointerId: 9, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'click-candidate',
      drawOutlineHasLandingPoint: 'true',
    });

    dispatchPointer(window, 'pointerup', { pointerId: 9, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineGesture: 'idle',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]')).not.toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('keeps micro-movement below the draw outline pan threshold as a click', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { pointerId: 10, button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(window, 'pointermove', { pointerId: 10, button: 0, clientX: 48, clientY: 31 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineGesture: 'click-candidate',
      drawOutlinePointCount: '0',
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    dispatchPointer(window, 'pointerup', { pointerId: 10, button: 0, clientX: 48, clientY: 31 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineGesture: 'idle',
      drawOutlinePointCount: '1',
    });

    rendered.unmount();
  });

  it('cancels draw outline point placement after crossing the left-drag threshold outside the pergola outline', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const onViewportTransformChange = vi.fn();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!scroller || !svg) throw new Error('Missing model-space scroller or SVG.');
    installSvgPointMock(svg);

    dispatchPointer(scroller, 'pointerdown', { pointerId: 11, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointermove', { pointerId: 11, button: 0, clientX: 36, clientY: -2 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'drag-cancelled',
      drawOutlinePreviewKind: 'none',
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    dispatchPointer(window, 'pointerup', { pointerId: 11, button: 0, clientX: 36, clientY: -2 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'idle',
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('cancels a pending draw outline click without placing a point', () => {
    const drawing = makeDrawingModule();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { pointerId: 12, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineGesture: 'click-candidate',
      drawOutlinePointCount: '0',
    });

    dispatchPointer(window, 'pointercancel', { pointerId: 12, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlineGesture: 'idle',
      drawOutlinePointCount: '0',
    });

    rendered.unmount();
  });

  it('starts inactive model-space panning only from the right mouse button', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const rendered = renderIntoDocument(
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');

    dispatchPointer(scroller, 'pointerdown', { pointerId: 13, button: 0, clientX: 100, clientY: 120 });
    dispatchPointer(window, 'pointermove', { pointerId: 13, button: 0, buttons: 1, clientX: 116, clientY: 130 });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    dispatchPointer(window, 'pointerup', { pointerId: 13, button: 0, clientX: 116, clientY: 130 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineGesture: 'idle',
      modelSpaceGesture: 'idle',
    });

    dispatchPointer(scroller, 'pointerdown', { pointerId: 14, button: 2, clientX: 100, clientY: 120 });
    dispatchPointer(window, 'pointermove', { pointerId: 14, button: 2, buttons: 2, clientX: 116, clientY: 130 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        panX: viewportTransform.panX + 16,
        panY: viewportTransform.panY + 10,
      }),
    );

    dispatchPointer(window, 'pointerup', { pointerId: 14, button: 2, clientX: 116, clientY: 130 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineGesture: 'idle',
    });

    rendered.unmount();
  });

  it('keeps draw outline landing diagnostics finite with viewport transform props', () => {
    const drawing = makeDrawingModule();
    const renderViewport = (viewportTransform = createDrawingWorkbenchUiState().viewportTransform) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={1}
        viewportTransform={viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointermove', { clientX: 45, clientY: 28 });
    const initial = expectFiniteDrawOutlineLanding(rendered.container);

    rendered.rerender(renderViewport({ zoom: 2, panX: 40, panY: -30 }));
    dispatchPointer(svg, 'pointermove', { clientX: 45, clientY: 28 });
    const transformed = expectFiniteDrawOutlineLanding(rendered.container);
    expect(transformed.alongM).toBeCloseTo(initial.alongM, 3);
    expect(transformed.depthM).toBeCloseTo(initial.depthM, 3);

    rendered.unmount();
  });

  it('renders a hover preview edge during draw outline without committing it', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 28 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineHasPendingPoint: 'false',
      drawOutlinePreviewKind: 'hover',
      drawOutlineCloseReady: 'false',
      drawOutlineCloseHovered: 'false',
      drawOutlineHasLandingPoint: 'true',
      drawOutlineAngleMode: 'absolute',
      drawOutlineHasError: 'false',
    });
    expectFiniteDrawOutlineLanding(rendered.container);
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex="hover"]')).not.toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    dispatchEscape();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'inactive',
      drawOutlineHasLandingPoint: 'false',
    });
    expect(getDrawOutlineLandingMarker(rendered.container)).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('arms a one-segment distance lock from typed distance input and places the next point at that radius', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('2');
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineDistanceDraft: '2',
      drawOutlineDistanceHudActive: 'true',
    });
    expect(getDrawOutlineDistanceHud(rendered.container)?.textContent).toContain('2m');
    dispatchWindowKey('Enter');
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 48 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'locked-distance',
      drawOutlinePointCount: '1',
      drawOutlineHasPendingPoint: 'false',
      drawOutlinePreviewKind: 'locked-distance',
      drawOutlineCloseReady: 'false',
      drawOutlineCloseHovered: 'false',
      drawOutlineHasLandingPoint: 'true',
      drawOutlineAngleMode: 'absolute',
      drawOutlineHasError: 'false',
      drawOutlinePreviewSource: 'locked-distance',
      drawOutlineLengthLocked: 'true',
      drawOutlineLockedDistanceDraft: '2',
      drawOutlineDistanceDraft: '',
      drawOutlineDistanceHudActive: 'false',
    });
    expectFiniteDrawOutlineLanding(rendered.container);
    expect(getDrawOutlineDistanceHud(rendered.container)).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="locked-distance"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex="locked-distance"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).toBeNull();
    expect(getDrawOutlineLockedRadiusMarker(rendered.container)).not.toBeNull();
    expect(getDrawOutlineLockedRadiusMarker(rendered.container)?.querySelector('line')).not.toBeNull();
    expect(getDrawOutlineLockedRadiusMarker(rendered.container)?.querySelector('circle')).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '2',
      drawOutlinePreviewKind: 'none',
      drawOutlineHasPendingPoint: 'false',
      drawOutlineLengthLocked: 'false',
      drawOutlineLockedDistanceDraft: '',
      drawOutlineDistanceHudActive: 'false',
    });
    expect(getDrawOutlineLockedRadiusMarker(rendered.container)).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="locked-distance"]')).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('right-drags a selected house-first opening hit target to pan instead of starting opening drag', async () => {
    const house = makeHouseFirstHouse({
      openings: [makeHouseFirstOpening()],
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness initialHouse={house} initialSelection={{ kind: 'opening', targetId: 'opening-1' }} />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const openingHit = rendered.container.querySelector('[data-object-workbench-shape-hit="opening:opening-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !openingHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(openingHit, 'pointerdown', { pointerId: 62, button: 2, clientX: 50, clientY: 50 });
    expect(scroller.dataset.modelSpaceGesture).toBe('mouse-pan');

    dispatchPointer(window, 'pointermove', { pointerId: 62, button: 2, buttons: 2, clientX: 250, clientY: 50 });
    expect(scroller.dataset.objectWorkbenchOpeningDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 62, button: 2, clientX: 250, clientY: 50 });
    expect(scroller.dataset.modelSpaceGesture).toBe('idle');
    expect(rendered.container.querySelector('[data-testid="opening-offset"]')?.textContent).toBe('0.6');

    rendered.unmount();
  });

  it('right-drags custom-vertex hit targets to pan instead of moving a footprint vertex', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const onViewportTransformChange = vi.fn();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    const vertexHit = rendered.container.querySelector('[data-footprint-custom-vertex-hit="0"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!vertexHit || !scroller) throw new Error('Missing custom vertex hit target.');

    onViewportTransformChange.mockClear();
    dispatchPointer(vertexHit, 'pointerdown', { pointerId: 63, button: 2, clientX: 45, clientY: 28 });
    dispatchPointer(window, 'pointermove', { pointerId: 63, button: 2, buttons: 2, clientX: 61, clientY: 40 });

    expect(scroller.dataset.modelSpaceGesture).toBe('mouse-pan');
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        panX: viewportTransform.panX + 16,
        panY: viewportTransform.panY + 12,
      }),
    );
    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 63, button: 2, clientX: 61, clientY: 40 });
    expect(scroller.dataset.modelSpaceGesture).toBe('idle');

    rendered.unmount();
  });

  it('renders a close-ready start target after three confirmed draw outline points', () => {
    const drawing = makeDrawingModule();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    expect(rendered.container.querySelector('[data-footprint-custom-close-target]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-close-hit]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-active-edge="true"]')?.getAttribute('data-footprint-custom-edge')).toBe('0');
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'close-ready',
      drawOutlinePointCount: '3',
      drawOutlineHasPendingPoint: 'false',
      drawOutlinePreviewKind: 'none',
      drawOutlineCloseReady: 'true',
      drawOutlineCloseHovered: 'false',
      drawOutlineAngleMode: 'relative',
      drawOutlineHasError: 'false',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-close-target="0"]')).not.toBeNull();
    expect(rendered.container.querySelectorAll('[data-footprint-custom-close-target]')).toHaveLength(1);
    expect(rendered.container.querySelector('[data-footprint-custom-close-hit="0"]')).not.toBeNull();
    expect(rendered.container.querySelectorAll('[data-footprint-custom-close-hit]')).toHaveLength(1);
    expect(rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-active-edge="true"]')?.getAttribute('data-footprint-custom-edge')).toBe('1');

    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 58 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'close-ready',
      drawOutlineCloseHovered: 'false',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-close-hovered="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-close-preview="true"]')).toBeNull();

    dispatchPointer(svg, 'pointermove', { clientX: 45.05, clientY: 28.05 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'close-hovered',
      drawOutlinePreviewKind: 'hover',
      drawOutlineCloseHovered: 'true',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-close-hovered="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-close-preview="true"]')).not.toBeNull();

    rendered.unmount();
  });

  it('constrains draw outline clicks to world-axis right angles while shift is held', async () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(svg, 'pointermove', { clientX: 92, clientY: 38, shiftKey: true });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePreviewKind: 'hover',
      drawOutlinePreviewSource: 'hover',
    });

    dispatchDrawClick(svg, { button: 0, clientX: 92, clientY: 38, shiftKey: true });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlinePointCount: '2',
      drawOutlinePreviewKind: 'none',
      drawOutlineHasPendingPoint: 'false',
    });

    dispatchPointer(svg, 'pointermove', { clientX: 78, clientY: 76, shiftKey: true });
    dispatchDrawClick(svg, { button: 0, clientX: 78, clientY: 76, shiftKey: true });

    await act(async () => {
      const closeHit = rendered.container.querySelector('[data-footprint-custom-close-hit="0"]');
      if (!closeHit) throw new Error('Missing close-ready start hit target.');
      dispatchPointer(closeHit, 'pointerdown', { pointerId: 92, button: 0, clientX: 45, clientY: 28 });
      dispatchPointer(window, 'pointerup', { pointerId: 92, button: 0, clientX: 45, clientY: 28 });
      await Promise.resolve();
    });

    expect(commitFootprintEdit).toHaveBeenCalledTimes(1);
    const polygon = (commitFootprintEdit.mock.calls as unknown as Array<[{ type: 'custom_polygon'; polygon: Array<{ alongM: string; depthM: string }> }]>)[0]?.[0]
      ?.polygon;
    if (!polygon) throw new Error('Missing committed polygon.');
    const [first, second, third] = polygon.map((point) => ({
      alongM: Number.parseFloat(point.alongM),
      depthM: Number.parseFloat(point.depthM),
    }));
    expect(second?.depthM).toBeCloseTo(first?.depthM ?? Number.NaN, 3);
    expect(third?.alongM).toBeCloseTo(second?.alongM ?? Number.NaN, 3);

    rendered.unmount();
  });

  it('places a locked segment on the nearest world axis when shift is held', async () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('2');
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineDistanceDraft: '2',
      drawOutlineDistanceHudActive: 'true',
    });
    dispatchWindowKey('Enter');
    dispatchPointer(svg, 'pointermove', { clientX: 54, clientY: 84, shiftKey: true });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'locked-distance',
      drawOutlineLengthLocked: 'true',
    });

    dispatchDrawClick(svg, { button: 0, clientX: 54, clientY: 84, shiftKey: true });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '2',
      drawOutlineLengthLocked: 'false',
    });
    expect(getDrawOutlineDistanceHud(rendered.container)).toBeNull();

    dispatchDrawClick(svg, { button: 0, clientX: 78, clientY: 76 });
    await act(async () => {
      const closeHit = rendered.container.querySelector('[data-footprint-custom-close-hit="0"]');
      if (!closeHit) throw new Error('Missing close-ready start hit target.');
      dispatchPointer(closeHit, 'pointerdown', { pointerId: 93, button: 0, clientX: 45, clientY: 28 });
      dispatchPointer(window, 'pointerup', { pointerId: 93, button: 0, clientX: 45, clientY: 28 });
      await Promise.resolve();
    });

    expect(commitFootprintEdit).toHaveBeenCalledTimes(1);
    const polygon = (commitFootprintEdit.mock.calls as unknown as Array<[{ type: 'custom_polygon'; polygon: Array<{ alongM: string; depthM: string }> }]>)[0]?.[0]
      ?.polygon;
    if (!polygon) throw new Error('Missing committed polygon.');
    const [first, second] = polygon.map((point) => ({
      alongM: Number.parseFloat(point.alongM),
      depthM: Number.parseFloat(point.depthM),
    }));
    expect(second?.alongM).toBeCloseTo(first?.alongM ?? Number.NaN, 3);
    expect(Math.abs((second?.depthM ?? Number.NaN) - (first?.depthM ?? Number.NaN))).toBeCloseTo(2, 3);

    rendered.unmount();
  });

  it('exposes draw outline distance validation errors through viewport diagnostics', async () => {
    const drawing = makeDrawingModule();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('0');
    dispatchWindowKey('Enter');

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'error',
      drawOutlinePointCount: '1',
      drawOutlineHasError: 'true',
    });
    expect(rendered.container.textContent).toContain('Enter a valid segment distance.');

    rendered.unmount();
  });

  it('marks the draft outline invalid when typed distance validation fails with existing points', async () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchWindowKey('0');
    dispatchWindowKey('Enter');

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'error',
      drawOutlinePointCount: '1',
      drawOutlineHasError: 'true',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-invalid="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')?.getAttribute('data-footprint-custom-invalid')).toBe('true');
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('clicking the close-ready start target validates and commits the draw outline polygon', async () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });

    const genericStartHit = rendered.container.querySelector('[data-footprint-custom-vertex-hit="0"]');
    if (!genericStartHit) throw new Error('Missing generic start vertex hit target.');
    const PointerCtor = window.PointerEvent ?? MouseEvent;
    await act(async () => {
      genericStartHit.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 21, clientX: 45, clientY: 28 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, cancelable: true, button: 0, pointerId: 21, clientX: 45, clientY: 28 }));
      await Promise.resolve();
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    const secondVertexHit = rendered.container.querySelector('[data-footprint-custom-vertex-hit="1"]');
    if (!secondVertexHit) throw new Error('Missing non-close vertex hit target.');
    await act(async () => {
      secondVertexHit.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 22, clientX: 75, clientY: 28 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, cancelable: true, button: 0, pointerId: 22, clientX: 75, clientY: 28 }));
      await Promise.resolve();
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    const closeHit = rendered.container.querySelector('[data-footprint-custom-close-hit="0"]');
    if (!closeHit) throw new Error('Missing close-ready start hit target.');
    await act(async () => {
      closeHit.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 23, clientX: 45, clientY: 28 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, cancelable: true, button: 0, pointerId: 23, clientX: 45, clientY: 28 }));
      await Promise.resolve();
    });

    expect(commitFootprintEdit).toHaveBeenCalledTimes(1);
    expect(commitFootprintEdit).toHaveBeenCalledWith({
      type: 'custom_polygon',
      polygon: expect.arrayContaining([
        expect.objectContaining({ alongM: expect.any(String), depthM: expect.any(String) }),
      ]),
    });
    const firstCommit = (commitFootprintEdit.mock.calls as unknown as Array<[{ type: 'custom_polygon'; polygon: unknown[] }]>)[0]?.[0];
    expect(firstCommit?.polygon).toHaveLength(3);
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'inactive',
      drawOutlineHasLandingPoint: 'false',
    });
    expect(getDrawOutlineLandingMarker(rendered.container)).toBeNull();

    rendered.unmount();
  });

  it('commits a valid draw outline polygon from model-space plan clicks', async () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <TestModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());

    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });

    await act(async () => {
      const closeHit = rendered.container.querySelector('[data-footprint-custom-close-hit="0"]');
      if (!closeHit) throw new Error('Missing close-ready start hit target.');
      dispatchPointer(closeHit, 'pointerdown', { pointerId: 94, button: 0, clientX: 45, clientY: 28 });
      dispatchPointer(window, 'pointerup', { pointerId: 94, button: 0, clientX: 45, clientY: 28 });
      await Promise.resolve();
    });

    expect(commitFootprintEdit).toHaveBeenCalledTimes(1);
    expect(commitFootprintEdit).toHaveBeenCalledWith({
      type: 'custom_polygon',
      polygon: expect.arrayContaining([
        expect.objectContaining({ alongM: expect.any(String), depthM: expect.any(String) }),
      ]),
    });
    const firstCommit = (commitFootprintEdit.mock.calls as unknown as Array<[{ type: 'custom_polygon'; polygon: unknown[] }]>)[0]?.[0];
    expect(firstCommit?.polygon).toHaveLength(3);

    rendered.unmount();
  });

  it('shows house-first dimensions only for the selected shape in model space', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    expect(rendered.container.querySelector('[data-editable-field-id="house-main:widthM"]')).toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')).toBeNull();

    const footprintHit = rendered.container.querySelector('[data-object-workbench-shape-hit="footprint:house-main"]');
    if (!footprintHit) throw new Error('Missing footprint hit target.');
    clickElement(footprintHit);
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-editable-field-id="house-main:widthM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')).toBeNull();

    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    if (!deckHit) throw new Error('Missing deck hit target.');
    clickElement(deckHit);
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-editable-field-id="house-main:widthM"]')).toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostEndGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:centerOffsetM"]')).toBeNull();
    expect(rendered.container.textContent).not.toContain('0.00m');
    expect(
      rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')?.getAttribute(
        'data-object-workbench-dimension-emphasis',
      ),
    ).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'preset_snapped',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-relationship"]')?.textContent).toBe(
      'true',
    );

    rendered.unmount();
  });

  it('drags a selected house-first window along its host wall in model space', async () => {
    const house = makeHouseFirstHouse({
      openings: [makeHouseFirstOpening()],
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness initialHouse={house} initialSelection={{ kind: 'opening', targetId: 'opening-1' }} />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const openingHit = rendered.container.querySelector('[data-object-workbench-shape-hit="opening:opening-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !openingHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    expect(rendered.container.querySelector('[data-editable-field-id="opening-1:offsetAlongWallM"]')).not.toBeNull();
    expect(scroller.dataset.objectWorkbenchSelectedOpeningDragEligible).toBe('true');
    expect(scroller.dataset.objectWorkbenchOpeningDragPhase).toBe('selected');
    expect(scroller.dataset.objectWorkbenchOpeningPlacementState).toBe('none');
    expect(scroller.dataset.objectWorkbenchOpeningAffordanceState).toBe('idle');
    expect(scroller.dataset.objectWorkbenchOpeningReferenceGuideState).toBe('none');

    dispatchPointer(openingHit, 'pointerdown', { pointerId: 61, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 61, button: 0, buttons: 1, clientX: 250, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchOpeningDragActive).toBe('true');
    expect(scroller.dataset.objectWorkbenchOpeningDragPhase).toBe('dragging');
    expect(scroller.dataset.objectWorkbenchOpeningPlacementState).toBe('floating');
    expect(scroller.dataset.objectWorkbenchOpeningAffordanceState).toBe('floating');
    expect(scroller.dataset.objectWorkbenchOpeningReferenceGuideState).toBe('none');
    expect(scroller.dataset.objectWorkbenchOpeningHighlightTargetId).not.toBe('');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-preview-owner-kind="opening"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-preview-body-state="floating"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-reference-guide]')).toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 61, button: 0, clientX: 250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.objectWorkbenchOpeningDragActive).toBe('false');
    expect(scroller.dataset.objectWorkbenchOpeningDragPhase).toBe('selected');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="opening-offset"]')?.textContent).not.toBe('0.6');

    rendered.unmount();
  });

  it('drags a selected house-first hinged door along its host wall in model space', async () => {
    const house = makeHouseFirstHouse({
      openings: [
        makeHouseFirstOpening({
          label: 'Door 1',
          kind: 'hinged_door',
          panelCount: null,
          widthM: '0.9',
          heightM: '2.1',
          sillHeightM: '0',
        }),
      ],
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness initialHouse={house} initialSelection={{ kind: 'opening', targetId: 'opening-1' }} />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const openingHit = rendered.container.querySelector('[data-object-workbench-shape-hit="opening:opening-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !openingHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    expect(rendered.container.querySelector('[data-editable-field-id="opening-1:offsetAlongWallM"]')).not.toBeNull();
    expect(scroller.dataset.objectWorkbenchSelectedOpeningDragEligible).toBe('true');

    dispatchPointer(openingHit, 'pointerdown', { pointerId: 71, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 71, button: 0, buttons: 1, clientX: 250, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchOpeningDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 71, button: 0, clientX: 250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.objectWorkbenchOpeningDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="opening-offset"]')?.textContent).not.toBe('0.6');

    rendered.unmount();
  });

  it('drags a selected house-first stacker along its host wall in model space', async () => {
    const house = makeHouseFirstHouse({
      openings: [
        makeHouseFirstOpening({
          label: 'Stacker 1',
          kind: 'stacker',
          panelCount: null,
          widthM: '3.6',
          heightM: '2.1',
          sillHeightM: '0',
        }),
      ],
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness initialHouse={house} initialSelection={{ kind: 'opening', targetId: 'opening-1' }} />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const openingHit = rendered.container.querySelector('[data-object-workbench-shape-hit="opening:opening-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !openingHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    expect(rendered.container.querySelector('[data-editable-field-id="opening-1:offsetAlongWallM"]')).not.toBeNull();
    expect(scroller.dataset.objectWorkbenchSelectedOpeningDragEligible).toBe('true');

    dispatchPointer(openingHit, 'pointerdown', { pointerId: 72, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 72, button: 0, buttons: 1, clientX: 250, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchOpeningDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 72, button: 0, clientX: 250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.objectWorkbenchOpeningDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="opening-offset"]')?.textContent).not.toBe('0.6');

    rendered.unmount();
  });

  it('keeps unresolved house-first openings selectable but blocks drag until a host wall resolves', async () => {
    const house = makeHouseFirstHouse({
      openings: [
        makeHouseFirstOpening({
          hostWallId: 'wall-footprint-edge-99',
          hostEdgeId: null,
          wallId: 'rear',
          validation: {
            status: 'invalid',
            codes: ['missing_host_wall'],
            message: 'This opening no longer has a valid derived host wall. Select a new host wall before placing it.',
          },
        }),
      ],
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness initialHouse={house} initialSelection={{ kind: 'opening', targetId: 'opening-1' }} />,
    );

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');

    expect(scroller.dataset.objectWorkbenchSelectedOpeningDragEligible).toBe('false');
    expect(scroller.dataset.objectWorkbenchSelectedOpeningDragReason).toContain('resolvable host wall');
    expect(scroller.dataset.objectWorkbenchOpeningDragPhase).toBe('selected');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="opening-1"]')).toBeNull();

    rendered.unmount();
  });

  it('keeps attached preset deck interaction active on preset houses without a stored footprint polygon', async () => {
    const baseHouse = makeHouseFirstHouse();
    const deck = makeHouseFirstDeck();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          footprint: {
            ...baseHouse.footprint,
            polygon: [],
          },
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'preset_snapped',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-house-polygon"]')?.textContent).toBe(
      'geometry_projection',
    );
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 31, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 31, button: 0, buttons: 1, clientX: -250, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('snapped');

    dispatchPointer(window, 'pointerup', { pointerId: 31, button: 0, clientX: -250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    rendered.unmount();
  });

  it('opens the inline house-first editor and commits preset deck dimensions on Enter', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const widthLabel = rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]');
    if (!(widthLabel instanceof Element)) throw new Error('Missing deck width label.');
    clickElement(widthLabel);

    const popoverInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(popoverInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(popoverInput, '4.2', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="deck-width"]')?.textContent).toBe('4.2');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')?.textContent).toContain('4.20m');

    rendered.unmount();
  });

  it('reuses the inline editor for attached deck host-edge relationship dimensions', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const hostGapLabel = rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]');
    if (!(hostGapLabel instanceof Element)) throw new Error('Missing deck host-start gap label.');
    clickElement(hostGapLabel);

    const popoverInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(popoverInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(popoverInput, '0', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="deck-center-offset"]')?.textContent).toBe('-1');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')?.textContent).toContain('0.00m');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostEndGapM"]')?.textContent).toContain('2.00m');

    rendered.unmount();
  });

  it('commits custom footprint edge edits and cancels the inline editor on Escape', async () => {
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'footprint', targetId: 'house-main' }}
        initialHouse={makeHouseFirstHouse({
          footprint: {
            ...makeHouseFirstHouse().footprint,
            mode: 'custom_polygon',
            polygon: [
              { alongM: '0', depthM: '0' },
              { alongM: '6', depthM: '0' },
              { alongM: '6', depthM: '2.4' },
              { alongM: '0', depthM: '2.4' },
            ],
          },
        })}
      />,
    );

    const edgeHit = rendered.container.querySelector('[data-object-workbench-custom-edge-hit="house-main:edge:0"]');
    if (!edgeHit) throw new Error('Missing custom edge hit target.');
    clickElement(edgeHit);
    await act(async () => {
      await Promise.resolve();
    });

    const edgeLabel = rendered.container.querySelector('[data-editable-field-id="house-main:edge:0"]');
    if (!(edgeLabel instanceof Element)) throw new Error('Missing custom edge label.');
    expect(edgeLabel.textContent).toContain('6.00m');

    clickElement(edgeLabel);
    const cancelInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(cancelInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    act(() => {
      cancelInput.value = '8';
      cancelInput.dispatchEvent(new Event('input', { bubbles: true }));
      cancelInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[aria-label="Edit plan dimension"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="footprint-edge-0"]')?.textContent).toBe('6');

    clickElement(edgeLabel);
    const commitInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(commitInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(commitInput, '8', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="footprint-edge-0"]')?.textContent).toBe('8');
    expect(rendered.container.querySelector('[data-editable-field-id="house-main:edge:0"]')?.textContent).toContain('8.00m');

    rendered.unmount();
  });

  it('shows commit errors and keeps the previous deck geometry when a house-first dimension edit is rejected', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        rejectDeckCommit
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const widthLabel = rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]');
    if (!(widthLabel instanceof Element)) throw new Error('Missing deck width label.');
    clickElement(widthLabel);

    const popoverInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(popoverInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(popoverInput, '8', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Deck dimension rejected.');
    expect(rendered.container.querySelector('[data-testid="deck-width"]')?.textContent).toBe('4');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')?.textContent).toContain('4.00m');

    rendered.unmount();
  });

  it('shows deck snap preview and commits the snapped attached preset placement on release', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 11, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 11, button: 0, buttons: 1, clientX: -250, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('snapped');
    expect(scroller.dataset.objectWorkbenchDeckReferenceGuideState).toBe('none');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('snapped');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Wall attached');
    expect(rendered.container.querySelector('[data-object-workbench-preview-body-state="snapped"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-reference-guide]')).toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-snap-target="snapped"]')).not.toBeNull();
    const releasePreviewPoints = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'),
    );

    dispatchPointer(window, 'pointerup', { pointerId: 11, button: 0, clientX: -250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    const committedDeckAfter = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'),
    );
    expect(committedDeckAfter).not.toBe('');
    expect(releasePreviewPoints).not.toBe('');
    expect(rendered.container.querySelector('[data-testid="deck-center-offset"]')?.textContent).toBe('25');
    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Position updated');
    await act(async () => {
      rendered.unmount();
    });
  });

  it('pulls a snapped preset deck free and commits a floating rect from the dragged preview', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 21, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 21, button: 0, buttons: 1, clientX: -5000, clientY: -5000 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('floating');
    expect(scroller.dataset.objectWorkbenchDeckReferenceGuideState).toBe('witness');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('floating');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Floating');
    expect(rendered.container.querySelector('[data-object-workbench-preview-body-state="floating"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-reference-guide="witness"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-snap-target]')).toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 21, button: 0, clientX: -5000, clientY: -5000 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    expect(rendered.container.querySelector('[data-testid="deck-is-attached"]')?.textContent).toBe('false');
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-along"]')?.textContent).not.toBe('');
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-depth"]')?.textContent).not.toBe('');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Position updated');
    rendered.unmount();
  });

  it('auto-selects a preset deck and keeps dragging when started from an unselected state', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'house', targetId: null }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 25, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 25, button: 0, buttons: 1, clientX: -120, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 25, button: 0, buttons: 1, clientX: -220, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')).toBeNull();
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-preview-suppressed'),
    ).toBe('true');

    dispatchPointer(window, 'pointerup', { pointerId: 25, button: 0, clientX: -220, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');

    rendered.unmount();
  });

  it('click-selects an unselected preset deck without committing a drag', async () => {
    const commitSpy = vi.fn();
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'house', targetId: null }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        onDeckCommit={commitSpy}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 125, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointerup', { pointerId: 125, button: 0, clientX: 50, clientY: 50 });
    clickElement(svg);
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.objectWorkbenchSelectedDeckId).toBe('deck-1');
    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(commitSpy).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('keeps a selected preset deck selected after a plain click without committing a drag', async () => {
    const commitSpy = vi.fn();
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        onDeckCommit={commitSpy}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 126, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointerup', { pointerId: 126, button: 0, clientX: 50, clientY: 50 });
    clickElement(svg);
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.objectWorkbenchSelectedDeckId).toBe('deck-1');
    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(commitSpy).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('clears deck selection when an empty canvas click starts on the plan svg', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !scroller) throw new Error('Missing plan viewport nodes.');

    clickElement(svg);
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.objectWorkbenchSelectedDeckId).toBe('');

    rendered.unmount();
  });

  it('keeps an unselected deck selected when drag intent loses pointer capture before moving', async () => {
    const commitSpy = vi.fn();
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'house', targetId: null }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        onDeckCommit={commitSpy}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);
    (svg as unknown as { setPointerCapture: (pointerId: number) => void }).setPointerCapture = vi.fn();
    (svg as unknown as { releasePointerCapture: (pointerId: number) => void }).releasePointerCapture = vi.fn();
    (svg as unknown as { hasPointerCapture: (pointerId: number) => boolean }).hasPointerCapture = () => true;

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 126, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(svg, 'lostpointercapture', { pointerId: 126, button: 0, clientX: 50, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.objectWorkbenchSelectedDeckId).toBe('deck-1');
    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(commitSpy).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('emits shared deck interaction telemetry while dragging', async () => {
    const telemetrySpy = vi.fn();
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        onDeckInteractionTelemetryChange={telemetrySpy}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    await act(async () => {
      await Promise.resolve();
    });
    const telemetryCallsBeforeDrag = telemetrySpy.mock.calls.length;

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 24, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 24, button: 0, buttons: 1, clientX: -120, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 24, button: 0, buttons: 1, clientX: -220, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();
    expect(telemetrySpy.mock.calls.length).toBeGreaterThan(telemetryCallsBeforeDrag);
    expect(telemetrySpy.mock.calls.at(-1)?.[0]).toMatchObject({
      phase: 'dragging',
      placementState: 'snapped',
      canCommit: true,
    });

    dispatchPointer(window, 'pointerup', { pointerId: 24, button: 0, clientX: -220, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');

    rendered.unmount();
  });

  it('keeps dragging when selection briefly changes away from the active deck', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        renderSelectionControls
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    const selectHouseButton = rendered.container.querySelector('[data-testid="select-house-target"]');
    if (!svg || !deckHit || !scroller || !(selectHouseButton instanceof HTMLButtonElement)) {
      throw new Error('Missing plan viewport nodes.');
    }
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 26, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 26, button: 0, buttons: 1, clientX: -120, clientY: 50 });

    act(() => {
      selectHouseButton.click();
    });

    dispatchPointer(window, 'pointermove', { pointerId: 26, button: 0, buttons: 1, clientX: -220, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 26, button: 0, clientX: -220, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');

    rendered.unmount();
  });

  it('uses geometry-true deck drag coordinates in house mode', async () => {
    const renderCommittedDeckDepth = async (pointerMoveY: number) => {
      const deck = makeHouseFirstDeck({
        isAttached: false,
        presetType: 'rect_detached',
        presetRect: {
          widthM: '4',
          depthM: '3',
          centerOffsetM: '0',
          detachedGapM: '0.6',
        },
      });
      const baseHouse = makeHouseFirstHouse();
      const resolvedDeck = resolveDeckPresetGeometry({
        deck: deck as any,
        housePolygon: baseHouse.footprint.polygon,
      });
      const rendered = renderIntoDocument(
        <HouseFirstViewportHarness
          initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
          objectWorkbenchDisplayFamily="house_forms"
          initialHouse={makeHouseFirstHouse({
            decks: [
              {
                ...deck,
                hostEdgeId: resolvedDeck.hostEdgeId,
                floatingRect: resolvedDeck.floatingRect,
                presetRect: resolvedDeck.presetRect,
                outline: resolvedDeck.outline,
              },
            ],
          })}
        />,
      );

      const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
      const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
      if (!svg || !deckHit) throw new Error('Missing plan viewport nodes.');
      installProjectedSvgPointMock(svg);

      dispatchPointer(deckHit, 'pointerdown', { pointerId: 23, button: 0, clientX: 50, clientY: 50 });
      dispatchPointer(window, 'pointermove', { pointerId: 23, button: 0, buttons: 1, clientX: 50, clientY: pointerMoveY });
      dispatchPointer(window, 'pointerup', { pointerId: 23, button: 0, clientX: 50, clientY: pointerMoveY });
      await act(async () => {
        await Promise.resolve();
      });
      await flushAnimationFrame();
      await flushAnimationFrame();
      await flushAnimationFrame();
      const committedDepth = Number.parseFloat(
        rendered.container.querySelector('[data-testid="deck-floating-center-depth"]')?.textContent ?? '',
      );
      rendered.unmount();
      return committedDepth;
    };

    const draggedDownDepth = await renderCommittedDeckDepth(5000);
    const draggedUpDepth = await renderCommittedDeckDepth(-5000);

    expect(Number.isFinite(draggedDownDepth)).toBe(true);
    expect(Number.isFinite(draggedUpDepth)).toBe(true);
    expect(draggedDownDepth).not.toBe(draggedUpDepth);
  });

  it('keeps geometry-true deck dragging active in house mode when plan dimensions are not editable', async () => {
    const renderDraggedPreviewY = async (pointerMoveY: number) => {
      const deck = makeHouseFirstDeck({
        isAttached: false,
        presetType: 'rect_detached',
        presetRect: {
          widthM: '4',
          depthM: '3',
          centerOffsetM: '0',
          detachedGapM: '0.6',
        },
      });
      const baseHouse = makeHouseFirstHouse();
      const resolvedDeck = resolveDeckPresetGeometry({
        deck: deck as any,
        housePolygon: baseHouse.footprint.polygon,
      });
      const rendered = renderIntoDocument(
        <HouseFirstViewportHarness
          initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
          objectWorkbenchDisplayFamily="house_forms"
          initialHouse={makeHouseFirstHouse({
            decks: [
              {
                ...deck,
                hostEdgeId: resolvedDeck.hostEdgeId,
                floatingRect: resolvedDeck.floatingRect,
                presetRect: resolvedDeck.presetRect,
                outline: resolvedDeck.outline,
              },
            ],
          })}
          enablePlanEditing={false}
        />,
      );

      const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
      const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
      if (!svg || !deckHit) throw new Error('Missing plan viewport nodes.');
      installProjectedSvgPointMock(svg);

      expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]')).toBeNull();
      expect(rendered.container.querySelector('[data-plan-resize-handle-hit="plan:spanA"]')).toBeNull();

      dispatchPointer(deckHit, 'pointerdown', { pointerId: 123, button: 0, clientX: 50, clientY: 50 });
      dispatchPointer(window, 'pointermove', { pointerId: 123, button: 0, buttons: 1, clientX: 50, clientY: pointerMoveY });
      const previewY = polygonCentroidY(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'));
      dispatchPointer(window, 'pointerup', { pointerId: 123, button: 0, clientX: 50, clientY: pointerMoveY });
      await act(async () => {
        await Promise.resolve();
      });
      rendered.unmount();
      return previewY;
    };

    const draggedDownPreviewY = await renderDraggedPreviewY(5000);
    const draggedUpPreviewY = await renderDraggedPreviewY(-5000);

    expect(Number.isFinite(draggedDownPreviewY)).toBe(true);
    expect(Number.isFinite(draggedUpPreviewY)).toBe(true);
    expect(draggedDownPreviewY).toBeGreaterThan(draggedUpPreviewY);
  });

  it('maps top-projection deck drag right and up to the same screen directions', async () => {
    const renderDraggedPreviewCentroid = async (pointerMove: { x: number; y: number }) => {
      const deck = makeHouseFirstDeck({
        isAttached: false,
        presetType: 'rect_detached',
        presetRect: {
          widthM: '4',
          depthM: '3',
          centerOffsetM: '0',
          detachedGapM: '0.6',
        },
      });
      const baseHouse = makeHouseFirstHouse();
      const resolvedDeck = resolveDeckPresetGeometry({
        deck: deck as any,
        housePolygon: baseHouse.footprint.polygon,
      });
      const rendered = renderIntoDocument(
        <HouseFirstViewportHarness
          initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
          objectWorkbenchDisplayFamily="house_forms"
          initialHouse={makeHouseFirstHouse({
            decks: [
              {
                ...deck,
                hostEdgeId: resolvedDeck.hostEdgeId,
                floatingRect: resolvedDeck.floatingRect,
                presetRect: resolvedDeck.presetRect,
                outline: resolvedDeck.outline,
              },
            ],
          })}
        />,
      );

      const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
      const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
      if (!svg || !deckHit) throw new Error('Missing plan viewport nodes.');
      installProjectedSvgPointMock(svg);

      const startX = polygonCentroidX(deckHit);
      const startY = polygonCentroidY(deckHit);
      dispatchPointer(deckHit, 'pointerdown', { pointerId: 723, button: 0, clientX: 50, clientY: 50 });
      dispatchPointer(window, 'pointermove', {
        pointerId: 723,
        button: 0,
        buttons: 1,
        clientX: pointerMove.x,
        clientY: pointerMove.y,
      });
      const previewShape = rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]');
      const preview = {
        x: polygonCentroidX(previewShape),
        y: polygonCentroidY(previewShape),
      };
      dispatchPointer(window, 'pointerup', {
        pointerId: 723,
        button: 0,
        clientX: pointerMove.x,
        clientY: pointerMove.y,
      });
      await act(async () => {
        await Promise.resolve();
      });
      rendered.unmount();
      return { startX, startY, preview };
    };

    const draggedRight = await renderDraggedPreviewCentroid({ x: 5000, y: 50 });
    const draggedUp = await renderDraggedPreviewCentroid({ x: 50, y: -5000 });

    expect(draggedRight.preview.x).toBeGreaterThan(draggedRight.startX);
    expect(draggedUp.preview.y).toBeLessThan(draggedUp.startY);
  });

  it('keeps pergola and house plan geometry fixed while only the deck preview moves in merged house mode', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        objectWorkbenchDisplayFamily="house_forms"
        visibility={{
          house: true,
          pergolas: true,
          decks: true,
          openings: true,
        }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const houseShape = rendered.container.querySelector('[data-object-workbench-shape="footprint:house-main"]');
    const deckShape = rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]');
    const houseSurface = rendered.container.querySelector('[data-house-plan-surface="footprint"]');
    const pergolaFill = rendered.container.querySelector('[data-plan-primary-fill="true"]');
    if (!svg || !deckHit || !houseShape || !deckShape || !houseSurface || !pergolaFill) {
      throw new Error('Missing merged house-mode plan nodes.');
    }
    installProjectedSvgPointMock(svg);

    const houseShapeBefore = polygonPointsAttr(houseShape);
    const deckShapeBefore = polygonPointsAttr(deckShape);
    const houseSurfaceBefore = polygonPointsAttr(houseSurface);
    const pergolaFillBefore = polygonPointsAttr(pergolaFill);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 223, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 223, button: 0, buttons: 1, clientX: 50, clientY: -2400 });

    const previewShape = rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]');
    expect(previewShape).not.toBeNull();
    expect(rendered.container.querySelectorAll('[data-object-workbench-preview-shape="deck-1"]')).toHaveLength(1);
    expect(polygonPointsAttr(previewShape)).not.toBe(deckShapeBefore);
    const committedDeckDuringPreview = rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]');
    expect(committedDeckDuringPreview?.getAttribute('data-object-workbench-shape-preview-suppressed')).toBe('true');
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape-hit="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-hit-preview-suppressed'),
    ).toBe('true');
    expect(polygonPointsAttr(rendered.container.querySelector('[data-object-workbench-shape="footprint:house-main"]'))).toBe(houseShapeBefore);
    expect(polygonPointsAttr(committedDeckDuringPreview)).toBe(deckShapeBefore);
    expect(polygonPointsAttr(rendered.container.querySelector('[data-house-plan-surface="footprint"]'))).toBe(houseSurfaceBefore);
    expect(polygonPointsAttr(rendered.container.querySelector('[data-plan-primary-fill="true"]'))).toBe(pergolaFillBefore);

    dispatchPointer(window, 'pointerup', { pointerId: 223, button: 0, clientX: 50, clientY: -2400 });
    await act(async () => {
      await Promise.resolve();
    });
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();

    rendered.unmount();
  });

  it('commits the dragged deck position back into the rebuilt plan overlay in merged house mode', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        objectWorkbenchDisplayFamily="house_forms"
        visibility={{
          house: true,
          pergolas: true,
          decks: true,
          openings: true,
        }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const deckShape = rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]');
    if (!svg || !deckHit || !deckShape) {
      throw new Error('Missing merged house-mode deck nodes.');
    }
    installProjectedSvgPointMock(svg);

    const committedDeckBefore = polygonPointsAttr(deckShape);
    const committedDepthBefore =
      rendered.container.querySelector('[data-testid="deck-floating-center-depth"]')?.textContent ?? '';
    const committedOutlineAlongBefore =
      rendered.container.querySelector('[data-testid="deck-outline-0-along"]')?.textContent ?? '';
    const committedOutlineDepthBefore =
      rendered.container.querySelector('[data-testid="deck-outline-0-depth"]')?.textContent ?? '';
    dispatchPointer(deckHit, 'pointerdown', { pointerId: 323, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 323, button: 0, buttons: 1, clientX: 50, clientY: 5000 });

    const previewPoints = polygonPointsAttr(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'));
    expect(previewPoints).not.toBe(committedDeckBefore);

    dispatchPointer(window, 'pointerup', { pointerId: 323, button: 0, clientX: 50, clientY: 5000 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckSettleComplete(rendered.container, 80);

    const committedDeckAfter = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'),
    );
    const committedDepthAfter =
      rendered.container.querySelector('[data-testid="deck-floating-center-depth"]')?.textContent ?? '';
    const committedOutlineAlongAfter =
      rendered.container.querySelector('[data-testid="deck-outline-0-along"]')?.textContent ?? '';
    const committedOutlineDepthAfter =
      rendered.container.querySelector('[data-testid="deck-outline-0-depth"]')?.textContent ?? '';
    expect(committedDeckAfter).not.toBe(committedDeckBefore);
    expect(committedDepthAfter).not.toBe(committedDepthBefore);
    expect(committedOutlineAlongAfter).toBe(committedOutlineAlongBefore);
    expect(committedOutlineDepthAfter).not.toBe(committedOutlineDepthBefore);
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();

    rendered.unmount();
  });

  it('keeps deck dragging responsive through a plan svg rerender in house mode', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const initialHouse = makeHouseFirstHouse({
      decks: [
        {
          ...deck,
          hostEdgeId: resolvedDeck.hostEdgeId,
          floatingRect: resolvedDeck.floatingRect,
          presetRect: resolvedDeck.presetRect,
          outline: resolvedDeck.outline,
        },
      ],
    });
    const renderHarness = () => (
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={initialHouse}
        enablePlanEditing={false}
      />
    );
    const rendered = renderIntoDocument(renderHarness());

    let svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    if (!svg || !deckHit) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 126, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 126, button: 0, buttons: 1, clientX: 50, clientY: -1200 });
    const midPreviewY = polygonCentroidY(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'));

    rendered.rerender(renderHarness());
    svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing rerendered plan viewport svg.');
    installProjectedSvgPointMock(svg);

    dispatchPointer(window, 'pointermove', { pointerId: 126, button: 0, buttons: 1, clientX: 50, clientY: -2400 });
    const topPreviewY = polygonCentroidY(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'));

    expect(topPreviewY).toBeLessThan(midPreviewY);

    dispatchPointer(window, 'pointerup', { pointerId: 126, button: 0, clientX: 50, clientY: -2400 });
    await act(async () => {
      await Promise.resolve();
    });
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();

    rendered.unmount();
  });

  it('locks viewport pan and zoom while dragging a deck near the top edge', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        enablePlanEditing={false}
        wrapInScrollableAncestor
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg);
    const { scrollParent, getScrollTop, getScrollerRect } = installScrollableAncestorMock(rendered.container);

    await flushAnimationFrame();
    const initialScrollTop = getScrollTop();
    const initialScrollerRect = snapshotRect(getScrollerRect());
    dispatchPointer(deckHit, 'pointerdown', { pointerId: 130, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 130, button: 0, buttons: 1, clientX: 50, clientY: -1200 });
    const midPreviewY = polygonCentroidY(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'));
    dispatchPointer(window, 'pointermove', { pointerId: 130, button: 0, buttons: 1, clientX: 50, clientY: -4000 });
    const topPreviewY = polygonCentroidY(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'));

    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('true');
    expect(topPreviewY).toBeLessThan(midPreviewY);
    act(() => {
      scrollParent.scrollTop = initialScrollTop + 120;
      scrollParent.dispatchEvent(new Event('scroll'));
    });
    expect(getScrollTop()).toBe(initialScrollTop);
    expect(snapshotRect(getScrollerRect())).toEqual(initialScrollerRect);

    clickButtonByText(rendered.container, '+');

    dispatchWheel(scroller, { deltaY: -480, clientX: 50, clientY: 20 });
    dispatchGesture(scroller, 'gesturestart', { clientX: 50, clientY: 20, scale: 1.1 });
    dispatchGesture(scroller, 'gesturechange', { clientX: 50, clientY: 20, scale: 1.4 });
    dispatchPointer(scroller, 'pointerdown', { pointerId: 131, button: 2, clientX: 50, clientY: 20 });
    dispatchPointer(window, 'pointermove', { pointerId: 131, button: 2, buttons: 2, clientX: 250, clientY: 220 });

    dispatchPointer(window, 'pointerup', { pointerId: 131, button: 2, clientX: 250, clientY: 220 });
    dispatchPointer(window, 'pointerup', { pointerId: 130, button: 0, clientX: 50, clientY: -4000 });
    await act(async () => {
      await Promise.resolve();
    });
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();

    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('false');
    rendered.unmount();
  });

  it('keeps the deck preview and viewport stable while release commit is settling', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        enablePlanEditing={false}
        delayDeckCommit
        wrapInScrollableAncestor
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    if (!svg || !deckHit) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg);
    const { scrollParent, getScrollTop, getScrollerRect } = installScrollableAncestorMock(rendered.container);

    await flushAnimationFrame();
    const initialScrollTop = getScrollTop();
    const initialScrollerRect = snapshotRect(getScrollerRect());
    dispatchPointer(deckHit, 'pointerdown', { pointerId: 140, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 140, button: 0, buttons: 1, clientX: 50, clientY: -4000 });
    dispatchPointer(window, 'pointerup', { pointerId: 140, button: 0, clientX: 50, clientY: -4000 });

    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-preview-suppressed'),
    ).toBe('true');
    expect(rendered.container.querySelector('[data-testid="flush-deck-commit"]')).not.toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('true');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-release-outcome"]')?.textContent).toBe('pending');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe('holding-preview');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Applying deck position');
    act(() => {
      scrollParent.scrollTop = initialScrollTop + 120;
      scrollParent.dispatchEvent(new Event('scroll'));
    });
    expect(getScrollTop()).toBe(initialScrollTop);
    expect(snapshotRect(getScrollerRect())).toEqual(initialScrollerRect);

    const flushButton = rendered.container.querySelector('[data-testid="flush-deck-commit"]');
    if (!(flushButton instanceof HTMLButtonElement)) throw new Error('Missing flush deck commit button.');
    await act(async () => {
      flushButton.click();
      await Promise.resolve();
    });

    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('false');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-release-outcome"]')?.textContent).toBe('committed');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe('reconciling');
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-preview-suppressed'),
    ).toBe('true');
    act(() => {
      scrollParent.scrollTop = initialScrollTop + 120;
      scrollParent.dispatchEvent(new Event('scroll'));
    });
    expect(getScrollTop()).toBe(initialScrollTop + 120);
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();

    await waitForObjectWorkbenchDeckSettleComplete(rendered.container, 80);
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Position updated');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-release-outcome"]')?.textContent).toBe('committed');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe('complete');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-preview-suppressed'),
    ).toBe('false');
    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('false');
    expect(getScrollTop()).toBe(initialScrollTop + 120);
    expect(snapshotRect(getScrollerRect())).not.toEqual(initialScrollerRect);
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 220);
      });
    });
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();
    await act(async () => {
      rendered.unmount();
    });
  });

  it('restores the persisted deck geometry and keeps failure feedback visible when a drag commit is rejected', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        rejectDeckCommit
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 142, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 142, button: 0, buttons: 1, clientX: -250, clientY: 50 });
    dispatchPointer(window, 'pointerup', { pointerId: 142, button: 0, clientX: -250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-body-state="blocked"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-preview-anchor="blocked"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="deck-center-offset"]')?.textContent).toBe('0');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain("Couldn't move deck");
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-release-outcome"]')?.textContent).toBe('failed');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe('failed');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('blocked');
    expect(rendered.container.textContent).toContain('Deck dimension rejected.');

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 143, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 143, button: 0, buttons: 1, clientX: -120, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 143, button: 0, clientX: -120, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    rendered.unmount();
  });

  it('releases the deck settle lock on deadline when viewport drift never stabilizes after a successful commit', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        enablePlanEditing={false}
        delayDeckCommit
        wrapInScrollableAncestor
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    if (!svg || !deckHit) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg);
    const { getScrollTop, scroller } = installScrollableAncestorMock(rendered.container);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 141, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 141, button: 0, buttons: 1, clientX: 50, clientY: -4000 });
    dispatchPointer(window, 'pointerup', { pointerId: 141, button: 0, clientX: 50, clientY: -4000 });

    const flushButton = rendered.container.querySelector('[data-testid="flush-deck-commit"]');
    if (!(flushButton instanceof HTMLButtonElement)) throw new Error('Missing flush deck commit button.');

    let driftReadCount = 0;
    Object.defineProperty(scroller, 'getBoundingClientRect', {
      configurable: true,
      value: () => {
        driftReadCount += 1;
        return makeRect(16, 40 - getScrollTop() + driftReadCount * 0.75, 560, 240);
      },
    });

    await act(async () => {
      flushButton.click();
      await Promise.resolve();
    });

    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();

    await flushAnimationFrame();
    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();

    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 560);
      });
    });
    await flushAnimationFrame();

    expect(getDrawOutlineDiagnostics(rendered.container).houseFirstDeckDragLocked).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();

    rendered.unmount();
  });

  it('allows an immediate second deck drag right after the first release settles visually', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        enablePlanEditing={false}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 150, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 150, button: 0, buttons: 1, clientX: 50, clientY: -1200 });
    dispatchPointer(window, 'pointerup', { pointerId: 150, button: 0, clientX: 50, clientY: -1200 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 151, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 151, button: 0, buttons: 1, clientX: 50, clientY: -2400 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 151, button: 0, clientX: 50, clientY: -2400 });
    await act(async () => {
      await Promise.resolve();
    });
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');

    rendered.unmount();
  });

  it('tracks deck hover through the shared affordance state without showing the drag HUD', () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const deckShape = rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!deckHit || !deckShape || !scroller) throw new Error('Missing plan viewport nodes.');

    dispatchPointer(deckHit, 'pointermove', { pointerId: 201, clientX: 50, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragPhase).toBe('hover');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('hover');
    expect(scroller.dataset.objectWorkbenchHoveredDeckId).toBe('deck-1');
    expect(deckShape.getAttribute('data-object-workbench-shape-hovered')).toBe('true');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-hovered"]')?.textContent).toBe('deck-1');

    rendered.unmount();
  });

  it('keeps floating decks visually free while dragging them without live-snapping the deck body', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 22, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 22, button: 0, buttons: 1, clientX: 49.5, clientY: 49.5 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(scroller.dataset.objectWorkbenchDeckDragPhase).toBe('drag-intent');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('grabbed');
    expect(scroller.dataset.objectWorkbenchDeckReferenceGuideState).toBe('none');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('idle');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Deck grabbed');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-preview-anchor="grabbed"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-reference-guide]')).toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 22, button: 0, clientX: 49.5, clientY: 49.5 });
    await act(async () => {
      await Promise.resolve();
    });
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();

    expect(rendered.container.querySelector('[data-testid="deck-is-attached"]')?.textContent).toBe('false');
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-along"]')?.textContent).not.toBe('');
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-depth"]')?.textContent).not.toBe('');
    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();

    await act(async () => {
      rendered.unmount();
    });
  });

  it('snaps a floating preset deck onto the exact left house edge on release', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      hostEdgeId: 'front',
      primaryHostEdgeId: 'footprint-edge-3',
      presetRect: {
        widthM: '1.4',
        depthM: '2',
        centerOffsetM: '0',
        detachedGapM: '0.5',
      },
      floatingRect: {
        centerAlongM: '-0.85',
        centerDepthM: '0.9',
        widthM: '1.4',
        depthM: '1.4',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg, { xScale: 0.05, yScale: 0.05, xOffset: 0, yOffset: 0 });

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 24, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 24, button: 0, buttons: 1, clientX: 55.5, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckPlacementState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckReferenceGuideState).toBe('snap-lane');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('snap-available');
    expect(rendered.container.querySelector('[data-object-workbench-preview-body-state="snap-available"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-reference-guide="snap-lane"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-snap-target="snap-available"]')).not.toBeNull();
    const releasePreviewPoints = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'),
    );

    dispatchPointer(window, 'pointerup', { pointerId: 24, button: 0, clientX: 55.5, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    const committedDeckAfter = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'),
    );
    expect(committedDeckAfter).not.toBe('');
    expect(releasePreviewPoints).not.toBe('');

    expect(rendered.container.querySelector('[data-testid="deck-is-attached"]')?.textContent).toBe('true');
    expect(rendered.container.querySelector('[data-testid="deck-host-edge"]')?.textContent).toBe('left');
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-along"]')?.textContent).toBe('');

    rendered.unmount();
  });

  it('snaps a floating preset deck onto the exact front house edge on release without a post-release jump', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      hostEdgeId: null,
      presetRect: {
        widthM: '3',
        depthM: '2',
        centerOffsetM: '0',
        detachedGapM: '0.5',
      },
      floatingRect: {
        centerAlongM: '3',
        centerDepthM: '2.85',
        widthM: '3',
        depthM: '2',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg, { xScale: 0.05, yScale: 0.05, xOffset: 0, yOffset: 0 });

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 324, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 324, button: 0, buttons: 1, clientX: 50, clientY: 85 });

    expect(scroller.dataset.objectWorkbenchDeckPlacementState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckReferenceGuideState).toBe('snap-lane');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('snap-available');
    const releasePreviewPoints = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'),
    );

    dispatchPointer(window, 'pointerup', { pointerId: 324, button: 0, clientX: 50, clientY: 85 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckDragUnlock(rendered.container);

    const committedDeckAfter = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'),
    );
    expect(committedDeckAfter).not.toBe('');
    expect(releasePreviewPoints).not.toBe('');
    expect(rendered.container.querySelector('[data-testid="deck-is-attached"]')?.textContent).toBe('true');
    expect(rendered.container.querySelector('[data-testid="deck-host-edge"]')?.textContent).toBe('front');
    expect(rendered.container.querySelector('[data-testid="deck-primary-host-edge"]')?.textContent).toBe(
      'footprint-edge-3',
    );
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-along"]')?.textContent).toBe('');

    rendered.unmount();
  });

  it('keeps a right-wall snapped release frozen until the rebuilt committed deck matches the preview geometry', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      hostEdgeId: null,
      presetRect: {
        widthM: '3',
        depthM: '2',
        centerOffsetM: '0',
        detachedGapM: '0.5',
      },
      floatingRect: {
        centerAlongM: '7',
        centerDepthM: '1.2',
        widthM: '3',
        depthM: '2',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        delayDeckCommit
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg, { xScale: 0.05, yScale: 0.05, xOffset: 0, yOffset: 0 });
    const releasePointerCapture = vi.fn();
    (svg as unknown as { releasePointerCapture: (pointerId: number) => void }).releasePointerCapture =
      releasePointerCapture;
    (svg as unknown as { hasPointerCapture: (pointerId: number) => boolean }).hasPointerCapture = () => true;

    const committedDeckBefore = polygonPointsAttr(rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'));

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 224, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 224, button: 0, buttons: 1, clientX: -10, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckPlacementState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckReferenceGuideState).toBe('snap-lane');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('snap-available');
    expect(rendered.container.querySelector('[data-object-workbench-preview-body-state="snap-available"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 224, button: 0, clientX: -10, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    const releasePreviewPoints = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'),
    );
    expect(releasePreviewPoints).not.toBe(committedDeckBefore);
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-preview-suppressed'),
    ).toBe('true');
    expect(rendered.container.querySelector('[data-testid="flush-deck-commit"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-release-outcome"]')?.textContent).toBe('pending');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-release-placement"]')?.textContent).toBe(
      'snapped',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe(
      'holding-preview',
    );
    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(scroller.dataset.objectWorkbenchDeckDragLocked).toBe('true');
    expect(releasePointerCapture).toHaveBeenCalledWith(224);

    const flushButton = rendered.container.querySelector('[data-testid="flush-deck-commit"]');
    if (!(flushButton instanceof HTMLButtonElement)) throw new Error('Missing flush deck commit button.');
    await act(async () => {
      flushButton.click();
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="deck-telemetry-release-outcome"]')?.textContent).toBe(
      'committed',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe(
      'reconciling',
    );
    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(scroller.dataset.objectWorkbenchDeckDragLocked).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-preview-suppressed'),
    ).toBe('true');
    expect(polygonPointsAttr(rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'))).not.toBe('');

    await waitForObjectWorkbenchDeckSettleComplete(rendered.container, 80);

    const committedDeckAfter = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'),
    );
    expect(committedDeckAfter).not.toBe(committedDeckBefore);
    expect(releasePreviewPoints).not.toBe('');
    expect(rendered.container.querySelector('[data-testid="deck-is-attached"]')?.textContent).toBe('true');
    expect(rendered.container.querySelector('[data-testid="deck-host-edge"]')?.textContent).toBe('right');
    expect(rendered.container.querySelector('[data-testid="deck-primary-host-edge"]')?.textContent).toBe(
      'footprint-edge-2',
    );
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-along"]')?.textContent).toBe('');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe(
      'complete',
    );
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(
      rendered.container
        .querySelector('[data-object-workbench-shape="deck:deck-1"]')
        ?.getAttribute('data-object-workbench-shape-preview-suppressed'),
    ).toBe('false');

    rendered.unmount();
  });

  it('unlocks a snapped deck release on the settle deadline when committed geometry still differs', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      hostEdgeId: null,
      presetRect: {
        widthM: '3',
        depthM: '2',
        centerOffsetM: '0',
        detachedGapM: '0.5',
      },
      floatingRect: {
        centerAlongM: '3',
        centerDepthM: '-1.05',
        widthM: '3',
        depthM: '2',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        forceDeckCommitMismatch
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg, { xScale: 0.05, yScale: 0.05, xOffset: 0, yOffset: 0 });

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 424, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 424, button: 0, buttons: 1, clientX: 50, clientY: 43.9 });

    expect(scroller.dataset.objectWorkbenchDeckPlacementState).toBe('snap-available');
    const releasePreviewPoints = polygonPointsAttr(
      rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]'),
    );

    dispatchPointer(window, 'pointerup', { pointerId: 424, button: 0, clientX: 50, clientY: 43.9 });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 560);
      });
    });
    await flushAnimationFrame();

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(scroller.dataset.objectWorkbenchDeckDragLocked).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(
      normalizePolygonPointSet(polygonPointsAttr(rendered.container.querySelector('[data-object-workbench-shape="deck:deck-1"]'))),
    ).not.toBe(normalizePolygonPointSet(releasePreviewPoints));
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-settle-visual"]')?.textContent).toBe(
      'complete',
    );

    const zoomBefore = getViewportTransformSnapshot(rendered.container).zoom;
    dispatchWheel(scroller, { deltaY: -120, clientX: 120, clientY: 90 });
    expect(getViewportTransformSnapshot(rendered.container).zoom).toBeGreaterThan(zoomBefore);

    const footprintHit = rendered.container.querySelector('[data-object-workbench-shape-hit^="footprint:"]');
    if (!footprintHit) throw new Error('Missing footprint hit target.');
    clickElement(footprintHit);
    await act(async () => {
      await Promise.resolve();
    });
    expect(scroller.dataset.objectWorkbenchSelectedDeckId).toBe('');

    rendered.unmount();
  });

  it('still snaps floating decks onto the side edges when plan dimensions are not editable', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      hostEdgeId: null,
      presetRect: {
        widthM: '1.4',
        depthM: '2',
        centerOffsetM: '0',
        detachedGapM: '0.5',
      },
      floatingRect: {
        centerAlongM: '-0.85',
        centerDepthM: '0.9',
        widthM: '1.4',
        depthM: '1.4',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
        enablePlanEditing={false}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installProjectedSvgPointMock(svg, { xScale: 0.05, yScale: 0.05, xOffset: 0, yOffset: 0 });

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 124, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 124, button: 0, buttons: 1, clientX: 55.5, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckPlacementState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckAffordanceState).toBe('snap-available');
    expect(scroller.dataset.objectWorkbenchDeckReferenceGuideState).toBe('snap-lane');
    expect(scroller.dataset.objectWorkbenchDeckSnapState).toBe('snap-available');
    expect(rendered.container.querySelector('[data-object-workbench-preview-body-state="snap-available"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-reference-guide="snap-lane"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-object-workbench-snap-target="snap-available"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 124, button: 0, clientX: 55.5, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();
    await flushAnimationFrame();

    expect(rendered.container.querySelector('[data-testid="deck-is-attached"]')?.textContent).toBe('true');
    expect(rendered.container.querySelector('[data-testid="deck-host-edge"]')?.textContent).toBe('left');
    expect(rendered.container.querySelector('[data-testid="deck-floating-center-along"]')?.textContent).toBe('');

    rendered.unmount();
  });

  it('treats floating preset decks as fully interactive and exposes witness dimensions', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              floatingRect: resolvedDeck.floatingRect,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:crossEdgeGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).toBeNull();
    expect(scroller?.dataset.objectWorkbenchSelectedDeckDragEligible).toBe('true');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'preset_floating',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-relationship"]')?.textContent).toBe(
      'true',
    );
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();

    rendered.unmount();
  });

  it('treats custom decks as draggable with relationship dimensions', async () => {
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            makeHouseFirstDeck({
              shape: 'custom',
              outline: [
                { alongM: '1', depthM: '0' },
                { alongM: '5', depthM: '0' },
                { alongM: '5', depthM: '-3' },
                { alongM: '1', depthM: '-3' },
              ],
            }),
          ],
        })}
      />,
    );

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:crossEdgeGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).toBeNull();
    expect(scroller?.dataset.objectWorkbenchSelectedDeckDragEligible).toBe('true');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'custom_outline',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-relationship"]')?.textContent).toBe(
      'true',
    );
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();

    rendered.unmount();
  });

  it('drags a selected custom deck as one translated outline in model space', async () => {
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            makeHouseFirstDeck({
              shape: 'custom',
              outline: [
                { alongM: '1', depthM: '0' },
                { alongM: '5', depthM: '0' },
                { alongM: '5', depthM: '-3' },
                { alongM: '1', depthM: '-3' },
              ],
            }),
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-object-workbench-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 81, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 81, button: 0, buttons: 1, clientX: 150, clientY: 50 });

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 81, button: 0, clientX: 150, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });
    await waitForObjectWorkbenchDeckSettleComplete(rendered.container, 80);

    expect(scroller.dataset.objectWorkbenchDeckDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-object-workbench-preview-shape="deck-1"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="deck-outline-0-along"]')?.textContent).not.toBe('1');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain('Position updated');
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 220);
      });
    });
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')).toBeNull();

    rendered.unmount();
  });
});
