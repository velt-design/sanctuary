import { describe, expect, it } from 'vitest';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import type { GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import type {
  DeckObjectModel,
  HouseAssemblyModel,
  HouseFormModel,
  OpeningObjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { buildPlanViewModel } from './buildPlanViewModel';
import type { ObjectWorkbenchPlanOverlayInput } from './objectWorkbenchPlanOverlay';

function makeHouseForm(): HouseFormModel {
  return {
    id: 'house-main',
    label: 'House',
    transform: {
      offsetXM: 0,
      offsetYM: 0,
      rotationQuarterTurns: 0,
    },
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
        { alongM: '6', depthM: '1.8' },
        { alongM: '0', depthM: '1.8' },
      ],
      attachmentSide: 'rear',
    },
    roofIntent: {
      form: 'mono',
      material: 'corrugated_iron',
      primaryPitchDeg: '5',
      primaryFallDirection: 'negative_y',
      ridgeAxis: 'x',
      openGableEndIds: [],
      appendage: {
        enabled: false,
        form: 'flat',
        hostEdge: 'rear',
        pitchDeg: '0',
        dropMm: '0',
      },
    },
    storeyMode: 'single_storey',
    attachmentStrategy: null,
  };
}

function makeHouseAssembly(houseForm: HouseFormModel): HouseAssemblyModel {
  return {
    id: 'assembly-main',
    label: 'House',
    houseForms: [houseForm],
    derivedEnvelope: {
      mergedFormIds: [houseForm.id],
      footprint: houseForm.footprint.polygon,
      wallGraph: {
        walls: [],
        mergeGroups: [],
      },
      roofZones: [],
      edges: [],
      attachmentZones: [],
    },
  };
}

function makePlanModelWithHouseContext(): ModulePlanModel {
  return {
    roofType: 'flat',
    pergolaStyle: null,
    drawingRotationQuarterTurns: 0,
    lengthA: 6,
    spanA: 3,
    lengthB: null,
    spanB: null,
    houseConnectionType: 'attached',
    attachmentSide: 'rear',
    houseFootprintPreset: 'straight',
    supportsHouseFootprints: true,
    rafterCountA: null,
    rafterSpacingA: null,
    ridgeBeamDepthM: 0,
    ridgeBeamWidthM: 0,
    soffitBracketPositionsA: [],
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
      lines: [],
    },
  } as unknown as ModulePlanModel;
}

function makeGeometryPlan(): GeometryPlanViewModel {
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
      footprint: [
        { x: 0, y: -2000 },
        { x: 7000, y: -2000 },
        { x: 7000, y: 0 },
        { x: 0, y: 0 },
      ],
      fasciaLine: null,
      roofEdgeLine: null,
      wallReferenceLine: {
        start: { x: 0, y: 0 },
        end: { x: 7000, y: 0 },
      },
      surfaces: [
        {
          id: 'solved-footprint',
          kind: 'footprint',
          boundary: [
            { x: 0, y: -2000 },
            { x: 7000, y: -2000 },
            { x: 7000, y: 0 },
            { x: 0, y: 0 },
          ],
        },
        {
          id: 'deck-1',
          kind: 'deck',
          boundary: [
            { x: 1000, y: 500 },
            { x: 4000, y: 500 },
            { x: 4000, y: 2500 },
            { x: 1000, y: 2500 },
          ],
        },
      ],
      lines: [
        {
          id: 'wall-rear-line',
          kind: 'wall_segment',
          line: {
            start: { x: 0, y: 0 },
            end: { x: 7000, y: 0 },
          },
          metadata: {
            sourceEdgeId: 'rear-edge',
          },
        },
      ],
    },
    members: {
      posts: [],
      beams: [],
      ledgers: [],
      rafters: [],
      gutters: [],
      ridge: [],
      joiners: [],
    },
    surfaces: {
      roofPlanes: [],
      roofCladding: [],
    },
    anchors: {
      primarySize: {
        length: null,
        projection: null,
      },
      fall: null,
      rafterSpacing: null,
      ridgeLine: null,
      attachmentSide: null,
    },
    extents: {
      minX: 0,
      minY: -2000,
      maxX: 7000,
      maxY: 3000,
      lengthMm: 7000,
      projectionMm: 5000,
    },
  };
}

function makeGeometryTopProjection(): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_left',
      y: 'world_y_down',
    },
    shapes: [
      {
        id: 'house_reference:solved-footprint-projection',
        sourceObjectId: 'house-footprint-scene',
        sourceId: 'solved-footprint',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
        polygon: [
          { x: 0, y: -2100 },
          { x: 7200, y: -2100 },
          { x: 7200, y: 0 },
          { x: 0, y: 0 },
        ],
        zOrder: 0,
        zMin: 0,
        zMax: 0,
        metadata: {
          topProjectionRole: 'context',
        },
      },
      {
        id: 'house_surface_solid:house-roof-top',
        sourceObjectId: 'house-roof-top',
        sourceId: 'house-roof-top',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'roof',
        polygon: [
          { x: 400, y: -1800 },
          { x: 6800, y: -1800 },
          { x: 6800, y: -200 },
          { x: 400, y: -200 },
        ],
        zOrder: 20,
        zMin: 2400,
        zMax: 3200,
        metadata: {
          topProjectionRole: 'top_visible',
        },
      },
      {
        id: 'house_line:wall-rear-line-projection',
        sourceObjectId: 'wall-rear-line',
        sourceId: 'rear-edge',
        sourceType: 'house_line',
        family: 'house',
        kind: 'wall_segment',
        polygon: [
          { x: 0, y: -15 },
          { x: 7000, y: -15 },
          { x: 7000, y: 15 },
          { x: 0, y: 15 },
        ],
        zOrder: 21,
        zMin: 0,
        zMax: 0,
        metadata: {
          sourceEdgeId: 'rear-edge',
          sourceWallId: 'wall-rear',
          hostEdgeSide: 'rear',
          planDetailRole: 'wall_edge',
          snapRole: 'deck_host_edge',
          topProjectionRole: 'context',
        },
      },
      {
        id: 'house_surface_solid:house-solid-deck-1',
        sourceObjectId: 'house-solid-deck-1',
        sourceId: 'house-solid-deck-1',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'deck',
        polygon: [
          { x: 1200, y: 650 },
          { x: 4400, y: 650 },
          { x: 4400, y: 2650 },
          { x: 1200, y: 2650 },
        ],
        zOrder: 42,
        zMin: 0,
        zMax: 120,
        metadata: {
          sourceId: 'deck-1',
        },
      },
      {
        id: 'house_surface:opening-1-marker',
        sourceObjectId: 'opening-1-marker',
        sourceId: 'opening-1',
        sourceType: 'house_surface',
        family: 'house',
        kind: 'opening_marker',
        polygon: [
          { x: 2100, y: 0 },
          { x: 3300, y: 0 },
          { x: 3300, y: -140 },
          { x: 2100, y: -140 },
        ],
        zOrder: 48,
        zMin: 0,
        zMax: 2100,
        metadata: {
          openingId: 'opening-1',
        },
      },
    ],
    extents: {
      minX: 0,
      minY: -2100,
      maxX: 7200,
      maxY: 2650,
      widthMm: 7200,
      heightMm: 4750,
    },
  };
}

function makeDeck(): DeckObjectModel {
  return {
    id: 'deck-1',
    label: 'Deck',
    kind: 'deck',
    shape: 'custom',
    presetType: null,
    presetRect: null,
    floatingRect: null,
    outline: [
      { alongM: '99', depthM: '99' },
      { alongM: '100', depthM: '99' },
      { alongM: '100', depthM: '100' },
      { alongM: '99', depthM: '100' },
    ],
    elevationMode: 'ground',
    levelOffsetMm: '0',
    isAttached: true,
    surfaceMaterial: 'timber_decking',
    hostEdgeId: 'rear-edge',
    primaryHostEdgeId: 'rear-edge',
  };
}

function makeOpening(): OpeningObjectModel {
  return {
    id: 'opening-1',
    label: 'Slider',
    kind: 'slider',
    panelCount: 2,
    hostWallId: null,
    wallId: 'rear',
    hostEdgeId: 'rear-edge',
    widthM: '1.2',
    heightM: '2.1',
    sillHeightM: '0',
    offsetAlongWallM: '2',
  };
}

function makeObjectWorkbenchOverlayInput(geometryPlan: GeometryPlanViewModel): ObjectWorkbenchPlanOverlayInput {
  const houseForm = makeHouseForm();
  return {
    houseAssembly: makeHouseAssembly(houseForm),
    houseForm,
    decks: [makeDeck()],
    openings: [makeOpening()],
    selection: { kind: 'deck', targetId: 'deck-1' },
    moduleLengthM: '6',
    moduleProjectionM: '3',
    geometryPlan,
    geometryTopProjection: makeGeometryTopProjection(),
    status: {
      houseForm: {
        lowConfidence: false,
        warnings: [],
        footprintPreset: houseForm.footprint.preset,
        roofForm: houseForm.roofIntent.form,
        defaultDeckHostEdgeId: 'rear',
        attachmentZoneBlockedSummary: 'none',
        roof: null,
      },
      deckStatuses: {},
      openingStatuses: {},
      pergolaStatuses: {},
      activeDeckSupport: null,
      activeDeckInteraction: null,
      deckSupportWarningCount: 0,
    },
  };
}

describe('buildPlanViewModel', () => {
  it('builds model-space overlay shapes from solved geometry rather than compatibility plan context', () => {
    const planModel = makePlanModelWithHouseContext();
    const geometryPlan = makeGeometryPlan();
    const geometryTopProjection = makeGeometryTopProjection();
    const viewModel = buildPlanViewModel({
      moduleId: 'module-1',
      moduleLabel: 'Module 1',
      planModel,
      geometryPlan,
      geometryTopProjection,
      canEditHouseFootprint: true,
      objectWorkbenchOverlayInput: makeObjectWorkbenchOverlayInput(geometryPlan),
    });

    const overlay = viewModel?.objectWorkbenchOverlay;
    const footprint = overlay?.shapes.find((shape) => shape.ownerKind === 'footprint');
    const deck = overlay?.shapes.find((shape) => shape.ownerKind === 'deck');
    const opening = overlay?.shapes.find((shape) => shape.ownerKind === 'opening');

    expect(overlay?.housePolygonSource).toBe('geometry_projection');
    expect(footprint).toEqual(
      expect.objectContaining({
        ownerKind: 'footprint',
        ownerId: 'house-main',
        geometrySourceId: 'house_surface_solid:house-roof-top',
        source: 'top_projection_committed',
        polygon: [
          { x: 0.4, y: -1.8 },
          { x: 6.8, y: -1.8 },
          { x: 6.8, y: -0.2 },
          { x: 0.4, y: -0.2 },
        ],
      }),
    );
    expect(deck).toEqual(
      expect.objectContaining({
        ownerKind: 'deck',
        ownerId: 'deck-1',
        geometrySourceId: 'house_surface_solid:house-solid-deck-1',
        source: 'top_projection_committed',
        selected: true,
        polygon: [
          { x: 1.2, y: 0.65 },
          { x: 4.4, y: 0.65 },
          { x: 4.4, y: 2.65 },
          { x: 1.2, y: 2.65 },
        ],
      }),
    );
    expect(deck?.deckInteraction?.snapFrameSource).toBe('top_projection_wall_edge');
    expect(deck?.deckInteraction?.referenceFrames[0]).toEqual(
      expect.objectContaining({
        sourceEdgeId: 'rear-edge',
        frameSource: 'top_projection_wall_edge',
      }),
    );
    expect(opening).toEqual(
      expect.objectContaining({
        ownerKind: 'opening',
        ownerId: 'opening-1',
        geometrySourceId: 'house_surface:opening-1-marker',
        source: 'top_projection_committed',
        polygon: [
          { x: 2.1, y: 0 },
          { x: 3.3, y: 0 },
          { x: 3.3, y: -0.14 },
          { x: 2.1, y: -0.14 },
        ],
      }),
    );
  });
});
