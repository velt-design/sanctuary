import { describe, expect, it } from 'vitest';
import {
  buildHouseFootprintPresetSideLocalPoints,
  houseFootprintSideLocalPointToWorld,
  resolveHouseFootprintFrame,
} from '@sp/geometry';
import type { ModulePlanHouseContext } from '@/app/staff/calculator/moduleViews';
import type { DeckModel, HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  buildHouseFirstPlanOverlay as buildHouseFirstPlanOverlayRaw,
  resizeCustomPolygonEdge,
} from './houseFirstPlanOverlay';
import { resolveDeckPresetGeometry } from '@/lib/drawings/state/houseFirstDeckPresets';

function makeDeck(overrides: Partial<DeckModel> = {}): DeckModel {
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

function makeHouse(overrides: Partial<HouseModel> = {}): HouseModel {
  const house: HouseModel = {
    id: 'house-main',
    label: 'House',
    confidence: 'high',
    lowConfidence: false,
    sourceModuleIndexes: [0],
    sourceModuleIds: ['module-1'],
    footprint: {
      mode: 'preset',
      preset: 'l_left',
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
    decks: [],
    openings: [],
    attachmentZones: [],
  };
  return {
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
}

function signedArea(polygon: Array<{ alongM: string; depthM: string }>): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    area += Number(current.alongM) * Number(next.depthM) - Number(next.alongM) * Number(current.depthM);
  }
  return area / 2;
}

function makeDraft(snapshot: Record<string, unknown> | null, mutate: (draft: EstimateDrawingDraft) => void) {
  const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
  if (!draft) throw new Error('Expected draft from snapshot.');
  mutate(draft);
  return draft;
}

function toScenePolygonMetres(points: Array<{ x: number; y: number }>) {
  return points.map((point) => ({
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3)),
  }));
}

function parsePolygonPoints(polygon: Array<{ alongM: string; depthM: string }>) {
  return polygon.map((point) => ({
    x: Number(point.alongM),
    y: Number(point.depthM),
  }));
}

function makeGeometryHouseContext(
  house: HouseModel,
  input: {
    moduleLengthM?: number;
    moduleProjectionM?: number;
  } = {},
): ModulePlanHouseContext {
  const moduleLengthM = input.moduleLengthM ?? 6;
  const moduleProjectionM = input.moduleProjectionM ?? 3;
  const offsetXM = Number(house.footprint.params.offsetXM ?? '0') || 0;
  const setbackM = Math.max(0, Number(house.footprint.params.setbackM ?? '0') || 0);
  const toWorldPoint = (
    point: { x: number; y: number },
    options: { unitFrame?: boolean; offsetXM?: number; setbackM?: number } = {},
  ) => {
    const unitFrame = options.unitFrame ?? false;
    const frame = resolveHouseFootprintFrame({
      pergolaWidthMm: Math.round((unitFrame ? 1 : moduleLengthM) * 1000),
      pergolaDepthMm: Math.round((unitFrame ? 1 : moduleProjectionM) * 1000),
      attachmentSide: house.footprint.attachmentSide,
    });
    const world = houseFootprintSideLocalPointToWorld({
      point: {
        alongM: point.x,
        depthM: point.y,
      },
      frame,
      resolved: {
        widthM: 1,
        offsetXM: options.offsetXM ?? 0,
        setbackM: options.setbackM ?? 0,
        bandDepthM: 1,
        returnRunM: 1,
        recessWidthM: 1,
        recessDepthM: 1,
        leftLegRunM: 1,
        rightLegRunM: 1,
        sideRunM: 1,
      },
    });
    return {
      x: Number((world.x / 1000).toFixed(6)),
      y: Number((world.y / 1000).toFixed(6)),
    };
  };
  const rawFootprint =
    house.footprint.mode === 'custom_polygon' && house.footprint.polygon.length
      ? parsePolygonPoints(house.footprint.polygon)
      : buildHouseFootprintPresetSideLocalPoints({
          pergolaWidthMm: Math.round(moduleLengthM * 1000),
          pergolaDepthMm: Math.round(moduleProjectionM * 1000),
          preset: house.footprint.preset,
          params: house.footprint.params,
          attachmentSide: house.footprint.attachmentSide,
        }).map((point) => ({
          x: point.alongM,
          y: point.depthM,
        }));
  const footprint = rawFootprint.map((point) =>
    toWorldPoint(point, {
      offsetXM,
      setbackM,
    }),
  );

  return {
    surfaces: [
      {
        id: 'house-footprint',
        kind: 'footprint',
        boundary: footprint,
      },
      ...house.decks.map((deck) => ({
        id: deck.id,
        kind: 'deck' as const,
        boundary: parsePolygonPoints(deck.outline).map((point) => toWorldPoint(point, { unitFrame: true })),
      })),
    ],
    lines: footprint.map((point, index) => ({
      id: `house-wall-${index + 1}`,
      kind: 'wall_segment' as const,
      line: {
        start: point,
        end: footprint[(index + 1) % footprint.length]!,
      },
      metadata: {
        sourceEdgeId: `footprint-edge-${index + 1}`,
      },
    })),
  };
}

function buildHouseFirstPlanOverlay(
  input: Omit<Parameters<typeof buildHouseFirstPlanOverlayRaw>[0], 'geometryHouseContext'> & {
    geometryHouseContext?: ModulePlanHouseContext | null;
  },
) {
  return buildHouseFirstPlanOverlayRaw({
    ...input,
    geometryHouseContext:
      input.geometryHouseContext ??
      (input.house
        ? makeGeometryHouseContext(input.house, {
            moduleLengthM: Number(input.moduleLengthM ?? '6') || 6,
            moduleProjectionM: Number(input.moduleProjectionM ?? '3') || 3,
          })
        : null),
  });
}

describe('houseFirstPlanOverlay', () => {
  it('builds preset footprint annotations for the selected house footprint only', () => {
    const overlay = buildHouseFirstPlanOverlay({
      house: makeHouse(),
      selection: { kind: 'footprint', targetId: 'house-main' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.shapes).toHaveLength(1);
    expect(overlay?.shapes[0]).toMatchObject({
      ownerKind: 'footprint',
      ownerId: 'house-main',
      selected: true,
      custom: false,
    });
    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual(
      expect.arrayContaining(['widthM', 'bandDepthM', 'returnRunM']),
    );
    expect(overlay?.customEdgeCandidates).toEqual([]);
  });

  it('builds preset deck annotations for the selected deck without a zero center offset label', () => {
    const baseHouse = makeHouse();
    const deck = makeDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '3.6',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const resolvedDeck = resolveDeckPresetGeometry({
      deck,
      housePolygon: baseHouse.footprint.polygon,
    });
    const house = makeHouse({
      decks: [
        {
          ...deck,
          presetRect: resolvedDeck.presetRect,
          outline: resolvedDeck.outline,
        },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'deck', targetId: 'deck-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.shapes).toHaveLength(2);
    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual(
      expect.arrayContaining(['widthM', 'depthM', 'referenceEdgeGapM', 'crossEdgeGapM']),
    );
    expect(overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'centerOffsetM')).toBeUndefined();
  });

  it('builds host-edge relationship dimensions for a selected attached preset deck', () => {
    const baseHouse = makeHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: makeDeck(),
      housePolygon: baseHouse.footprint.polygon,
    });
    const house = makeHouse({
      decks: [
        {
          ...makeDeck(),
          hostEdgeId: resolvedDeck.hostEdgeId,
          presetRect: resolvedDeck.presetRect,
          outline: resolvedDeck.outline,
        },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'deck', targetId: 'deck-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual(
      expect.arrayContaining(['widthM', 'depthM', 'hostStartGapM', 'hostEndGapM']),
    );
    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual([
      'widthM',
      'depthM',
      'hostStartGapM',
      'hostEndGapM',
    ]);
    expect(overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'widthM')).toMatchObject({
      emphasis: 'driving',
    });
    const hostStartGap = overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'hostStartGapM');
    const hostEndGap = overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'hostEndGapM');
    expect(hostStartGap).toMatchObject({
      targetKind: 'deck_host_edge_reference',
      emphasis: 'relationship',
    });
    expect(hostEndGap).toMatchObject({
      targetKind: 'deck_host_edge_reference',
      emphasis: 'relationship',
    });
    expect(Number.parseFloat(hostStartGap?.rawValue ?? '')).toBeGreaterThan(0);
    expect(Number.isFinite(Number.parseFloat(hostEndGap?.rawValue ?? ''))).toBe(true);
  });

  it('keeps attached preset decks resolved on preset houses without a stored footprint polygon', () => {
    const baseHouse = makeHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: makeDeck(),
      housePolygon: baseHouse.footprint.polygon,
    });
    const house = makeHouse({
      footprint: {
        ...baseHouse.footprint,
        polygon: [],
      },
      decks: [
        {
          ...makeDeck(),
          hostEdgeId: resolvedDeck.hostEdgeId,
          presetRect: resolvedDeck.presetRect,
          outline: resolvedDeck.outline,
        },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'deck', targetId: 'deck-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.housePolygonSource).toBe('preset_derived');
    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual([
      'widthM',
      'depthM',
      'hostStartGapM',
      'hostEndGapM',
    ]);
    expect(
      overlay?.shapes.find((shape) => shape.ownerKind === 'deck')?.deckDragEligibility,
    ).toEqual({
      eligible: true,
      reason: 'Drag the selected deck body to move it near the house edge or out in free space, or click dimensions to edit.',
    });
  });

  it('builds width and along-wall annotations for a selected window opening', () => {
    const house = makeHouse({
      openings: [
        {
          id: 'opening-1',
          label: 'Window 1',
          kind: 'window',
          panelCount: null,
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-1',
          widthM: '1.8',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.6',
          validation: {
            status: 'valid',
            codes: [],
            message: null,
          },
        },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'opening', targetId: 'opening-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.shapes.find((shape) => shape.ownerKind === 'opening' && shape.ownerId === 'opening-1')).toMatchObject({
      selected: true,
    });
    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual([
      'widthM',
      'offsetAlongWallM',
    ]);
    expect(overlay?.presetAnnotations.every((annotation) => annotation.targetKind === 'opening_param')).toBe(true);
  });

  it('adds lightweight panel cue segments for selected slider openings', () => {
    const house = makeHouse({
      openings: [
        {
          id: 'opening-slider',
          label: 'Slider 1',
          kind: 'slider',
          panelCount: 4,
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-1',
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.6',
          validation: {
            status: 'valid',
            codes: [],
            message: null,
          },
        },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'opening', targetId: 'opening-slider' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    const sliderShape = overlay?.shapes.find((shape) => shape.ownerId === 'opening-slider');
    expect(sliderShape?.detailSegments).toHaveLength(3);
    expect(sliderShape?.detailSegments.every((segment) => segment.start.y !== segment.end.y)).toBe(true);
  });

  it('anchors opening polygons to the resolved wall line instead of the roof or gutter line', () => {
    const house = makeHouse({
      openings: [
        {
          id: 'opening-1',
          label: 'Window 1',
          kind: 'window',
          panelCount: null,
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-1',
          widthM: '1.8',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.6',
          validation: {
            status: 'valid',
            codes: [],
            message: null,
          },
        },
      ],
    });
    const geometryHouseContext: ModulePlanHouseContext = {
      ...makeGeometryHouseContext(house),
      lines: [
        {
          id: 'wall-1',
          kind: 'wall_segment',
          line: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } },
          metadata: { sourceEdgeId: 'footprint-edge-1' },
        },
        {
          id: 'gutter-1',
          kind: 'gutter',
          line: { start: { x: 0, y: -0.45 }, end: { x: 6, y: -0.45 } },
          metadata: { sourceEdgeId: 'footprint-edge-1' },
        },
      ],
    };

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'opening', targetId: 'opening-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
      geometryHouseContext,
    });

    const openingShape = overlay?.shapes.find((shape) => shape.ownerKind === 'opening' && shape.ownerId === 'opening-1');
    expect(openingShape?.polygon[0]?.y).toBeCloseTo(0, 6);
    expect(openingShape?.polygon[1]?.y).toBeCloseTo(0, 6);
    expect(openingShape?.polygon.some((point) => Math.abs(point.y + 0.45) <= 1e-6)).toBe(false);
  });

  it('derives opening drag bounds from the resolved host wall span instead of the merged house side span', () => {
    const house = makeHouse({
      footprint: {
        mode: 'custom_polygon',
        preset: 'u_shape',
        polygon: [
          { alongM: '0', depthM: '0' },
          { alongM: '2', depthM: '0' },
          { alongM: '2', depthM: '2' },
          { alongM: '4', depthM: '2' },
          { alongM: '4', depthM: '0' },
          { alongM: '6', depthM: '0' },
          { alongM: '6', depthM: '4' },
          { alongM: '0', depthM: '4' },
        ],
      },
      openings: [
        {
          id: 'opening-1',
          label: 'Window 1',
          kind: 'window',
          panelCount: null,
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-1',
          widthM: '1.8',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.1',
          validation: {
            status: 'valid',
            codes: [],
            message: null,
          },
        },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'opening', targetId: 'opening-1' },
      moduleLengthM: '6',
      moduleProjectionM: '4',
    });

    const openingShape = overlay?.shapes.find((shape) => shape.ownerKind === 'opening' && shape.ownerId === 'opening-1');
    expect(openingShape?.openingInteraction?.hostSpanM).toBeCloseTo(2, 6);
    expect(openingShape?.openingInteraction?.maxOffsetAlongWallM).toBeCloseTo(0.2, 6);
  });

  it('keeps driving dimensions but omits relationship dimensions when the host edge is unresolved', () => {
    const baseHouse = makeHouse();
    const unresolvedDeck = makeDeck({
      hostEdgeId: 'unknown' as DeckModel['hostEdgeId'],
    });
    const house = makeHouse({
      decks: [
        {
          ...unresolvedDeck,
          presetRect: {
            widthM: '4',
            depthM: '3',
            centerOffsetM: '0',
          },
          outline: [
            { alongM: '1', depthM: '0' },
            { alongM: '5', depthM: '0' },
            { alongM: '5', depthM: '-3' },
            { alongM: '1', depthM: '-3' },
          ],
        },
      ],
      footprint: {
        ...baseHouse.footprint,
      },
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'deck', targetId: 'deck-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual(['widthM', 'depthM']);
    expect(
      overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'hostStartGapM'),
    ).toBeUndefined();
    expect(
      overlay?.shapes.find((shape) => shape.ownerKind === 'deck')?.deckDragEligibility,
    ).toEqual({
      eligible: false,
      reason:
        'This preset deck needs a resolvable house reference edge before drag and relationship dims are available.',
    });
  });

  it('keeps screenshot-style plan deck and footprint overlays aligned with the geometry preview scene', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('gable-u-hipped-screenshot');
    expect(fixture).not.toBeNull();
    if (!fixture) return;

    const draft = makeDraft(fixture.snapshot, (current) => {
      current.houseFirst = {
        decks: [
          {
            id: 'deck-debug',
            name: 'Debug deck',
            kind: 'deck',
            shape: 'preset',
            presetType: 'rect_attached',
            presetRect: {
              widthM: '3.6',
              depthM: '2.4',
              centerOffsetM: '0',
              detachedGapM: null,
            },
            elevationMode: 'aligned_to_threshold',
            levelOffsetMm: '0',
            hostEdgeId: 'rear',
            isAttached: true,
            surfaceMaterial: 'timber_decking',
          },
        ],
        openings: [
          {
            id: 'opening-debug',
            label: 'Debug window',
            kind: 'window',
            panelCount: null,
            wallId: 'rear',
            widthM: '1.8',
            heightM: '1.2',
            sillHeightM: '0.9',
            offsetAlongWallM: '0.6',
          },
        ],
      };
    });

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: {
        ...createDrawingWorkbenchUiState(),
        activeModuleIndex: 0,
        activeHouseTab: 'house',
        activeHouseSelection: { kind: 'opening', targetId: 'opening-debug' },
        viewportMode: 'model_space',
        activeView: 'plan',
        workbenchMode: 'house',
      },
    });
    const preview = buildWorkbenchGeometryPreview({
      projectId: fixture.estimate.id,
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;

    const overlay = buildHouseFirstPlanOverlay({
      house: store.derived.house,
      selection: { kind: 'opening', targetId: 'opening-debug' },
      moduleLengthM: String(store.derived.activePlanModel?.lengthA ?? ''),
      moduleProjectionM: String(store.derived.activePlanModel?.spanA ?? ''),
      geometryHouseContext: store.derived.activePlanModel?.houseContext ?? null,
    });

    const deckShape = overlay?.shapes.find((shape) => shape.ownerId === 'deck-debug');
    const openingShape = overlay?.shapes.find((shape) => shape.ownerId === 'opening-debug');
    const footprintShape = overlay?.shapes.find((shape) => shape.ownerKind === 'footprint');
    const houseObjects = preview.scene.layers.find((layer) => layer.id === 'house')?.objects ?? [];
    const deckSolidObject = houseObjects.find(
      (object) => object.type === 'house_surface_solid' && object.kind === 'deck',
    );
    const openingObject = houseObjects.find(
      (object) =>
        object.type === 'house_surface' &&
        object.kind === 'opening_marker' &&
        object.metadata?.openingId === 'opening-debug',
    );
    const wallObjects = houseObjects
      .filter(
        (object): object is Extract<(typeof houseObjects)[number], { type: 'house_surface_solid'; kind: 'wall' }> =>
          object.type === 'house_surface_solid' && object.kind === 'wall' && 'boundary' in object,
      )
      .sort((left, right) => {
        const leftIndex = Number(String(left.metadata?.sourceEdgeId ?? '').replace('footprint-edge-', ''));
        const rightIndex = Number(String(right.metadata?.sourceEdgeId ?? '').replace('footprint-edge-', ''));
        return leftIndex - rightIndex;
      });
    const sceneDeckPolygon =
      deckSolidObject && 'boundary' in deckSolidObject
        ? toScenePolygonMetres(
            deckSolidObject.boundary.map((point) => ({
              x: point.x / 1000,
              y: point.y / 1000,
            })),
          )
        : null;
    const sceneFootprintPolygon = toScenePolygonMetres(
      wallObjects.map((object) => ({
        x: object.boundary[0]!.x / 1000,
        y: object.boundary[0]!.y / 1000,
      })),
    );

    expect(deckShape?.polygon.length).toBeGreaterThan(0);
    expect(footprintShape?.polygon.length).toBeGreaterThan(0);
    expect(openingShape?.polygon.length).toBeGreaterThan(0);
    expect(deckSolidObject).toBeDefined();
    expect(toScenePolygonMetres(deckShape?.polygon ?? [])).toEqual(sceneDeckPolygon);
    expect(toScenePolygonMetres(footprintShape?.polygon ?? [])).toEqual(sceneFootprintPolygon);
    expect(openingObject).toBeUndefined();
    expect(preview.scene.metadata.houseOpeningSkippedInvalidCount).toBe(1);
    expect(store.derived.house?.openings[0]?.validation.status).toBe('invalid');
  });

  it('matches a valid opening plan polygon to the XY wall footprint of the 3D opening marker', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    expect(fixture).not.toBeNull();
    if (!fixture) return;

    const draft = makeDraft(fixture.snapshot, (current) => {
      current.houseFirst = {
        openings: [
          {
            id: 'opening-valid',
            label: 'Kitchen window',
            kind: 'window',
            panelCount: null,
            wallId: 'rear',
            widthM: '2.4',
            heightM: '1.2',
            sillHeightM: '0.9',
            offsetAlongWallM: '1.1',
          },
        ],
      };
    });

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: {
        ...createDrawingWorkbenchUiState(),
        activeModuleIndex: 0,
        activeHouseTab: 'house',
        activeHouseSelection: { kind: 'opening', targetId: 'opening-valid' },
        viewportMode: 'model_space',
        activeView: 'plan',
        workbenchMode: 'house',
      },
    });
    const preview = buildWorkbenchGeometryPreview({
      projectId: fixture.estimate.id,
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;

    const overlay = buildHouseFirstPlanOverlay({
      house: store.derived.house,
      selection: { kind: 'opening', targetId: 'opening-valid' },
      moduleLengthM: String(store.derived.activePlanModel?.lengthA ?? ''),
      moduleProjectionM: String(store.derived.activePlanModel?.spanA ?? ''),
      geometryHouseContext: store.derived.activePlanModel?.houseContext ?? null,
    });

    const openingShape = overlay?.shapes.find((shape) => shape.ownerKind === 'opening' && shape.ownerId === 'opening-valid');
    const openingMarker = preview.scene.layers
      .find((layer) => layer.id === 'house')
      ?.objects.find(
        (object) =>
          object.type === 'house_surface' &&
          object.kind === 'opening_marker' &&
          object.metadata?.openingId === 'opening-valid',
      );

    const markerWallEdge = openingMarker && 'boundary' in openingMarker
      ? Array.from(
          new Set(
            openingMarker.boundary.map((point) => `${(point.x / 1000).toFixed(3)},${(point.y / 1000).toFixed(3)}`),
          ),
        )
          .map((value) => {
            const [x, y] = value.split(',');
            return { x: Number(x), y: Number(y) };
          })
          .sort((left, right) => left.x - right.x || left.y - right.y)
      : [];
    const overlayWallEdge = (openingShape?.polygon ?? [])
      .slice(0, 2)
      .map((point) => ({
        x: Number(point.x.toFixed(3)),
        y: Number(point.y.toFixed(3)),
      }))
      .sort((left, right) => left.x - right.x || left.y - right.y);

    expect(markerWallEdge).toHaveLength(2);
    expect(overlayWallEdge).toHaveLength(2);
    expect(overlayWallEdge[0]?.x).toBeCloseTo(markerWallEdge[0]?.x ?? 0, 3);
    expect(overlayWallEdge[1]?.x).toBeCloseTo(markerWallEdge[1]?.x ?? 0, 3);
    expect(overlayWallEdge[0]?.y).toBeCloseTo(markerWallEdge[0]?.y ?? 0, 2);
    expect(overlayWallEdge[1]?.y).toBeCloseTo(markerWallEdge[1]?.y ?? 0, 2);
  });

  it('mutes secondary decks and carries deck invalidity on the selected deck only', () => {
    const baseHouse = makeHouse();
    const selectedDeckPreset = resolveDeckPresetGeometry({
      deck: makeDeck({
        id: 'deck-1',
        name: 'Deck 1',
      }),
      housePolygon: baseHouse.footprint.polygon,
    });
    const secondaryDeckPreset = resolveDeckPresetGeometry({
      deck: makeDeck({
        id: 'deck-2',
        name: 'Deck 2',
        isAttached: false,
        presetType: 'rect_detached',
        presetRect: {
          widthM: '3.6',
          depthM: '3',
          centerOffsetM: '0',
          detachedGapM: '0.8',
        },
      }),
      housePolygon: baseHouse.footprint.polygon,
    });

    const overlay = buildHouseFirstPlanOverlay({
      house: makeHouse({
        decks: [
          {
            ...makeDeck({
              id: 'deck-1',
              validation: {
                status: 'invalid',
                codes: ['outline_inside_house'],
                messages: ['Deck outline overlaps the house interior in an unsupported way.'],
                message: 'Deck outline overlaps the house interior in an unsupported way.',
              },
              presetRect: selectedDeckPreset.presetRect,
              outline: selectedDeckPreset.outline,
            }),
          },
          {
            ...makeDeck({
              id: 'deck-2',
              name: 'Deck 2',
              isAttached: false,
              presetType: 'rect_detached',
              presetRect: secondaryDeckPreset.presetRect,
              outline: secondaryDeckPreset.outline,
            }),
          },
        ],
      }),
      selection: { kind: 'deck', targetId: 'deck-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.shapes.find((shape) => shape.ownerId === 'deck-1')).toMatchObject({
      selected: true,
      muted: false,
      invalid: true,
      invalidMessage: 'Deck outline overlaps the house interior in an unsupported way.',
    });
    expect(overlay?.shapes.find((shape) => shape.ownerKind === 'footprint')).toMatchObject({
      selected: false,
      muted: true,
    });
    expect(overlay?.shapes.find((shape) => shape.ownerId === 'deck-2')).toMatchObject({
      selected: false,
      muted: true,
      invalid: false,
      invalidMessage: null,
    });
  });

  it('does not apply house footprint offset or setback to deck polygons in plan', () => {
    const deck = makeDeck({
      outline: [
        { alongM: '1', depthM: '0' },
        { alongM: '5', depthM: '0' },
        { alongM: '5', depthM: '-4' },
        { alongM: '1', depthM: '-4' },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house: makeHouse({
        footprint: {
          params: {
            offsetXM: '1.25',
            setbackM: '0.75',
          },
        },
        decks: [deck],
      }),
      selection: { kind: 'deck', targetId: 'deck-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    const deckShape = overlay?.shapes.find((shape) => shape.ownerKind === 'deck');
    expect(deckShape?.polygon).toHaveLength(4);
    expect(deckShape?.polygon[0]?.x).toBeCloseTo(1, 6);
    expect(deckShape?.polygon[0]?.y).toBeCloseTo(0, 6);
    expect(deckShape?.polygon[1]?.x).toBeCloseTo(5, 6);
    expect(deckShape?.polygon[1]?.y).toBeCloseTo(0, 6);
    expect(deckShape?.polygon[2]?.x).toBeCloseTo(5, 6);
    expect(deckShape?.polygon[2]?.y).toBeCloseTo(4, 6);
    expect(deckShape?.polygon[3]?.x).toBeCloseTo(1, 6);
    expect(deckShape?.polygon[3]?.y).toBeCloseTo(4, 6);

    const widthAnnotation = overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'widthM');
    expect(widthAnnotation?.witnessStart.x).toBeCloseTo(1, 6);
    expect(widthAnnotation?.witnessStart.y).toBeCloseTo(0, 6);
    expect(widthAnnotation?.witnessEnd.x).toBeCloseTo(5, 6);
    expect(widthAnnotation?.witnessEnd.y).toBeCloseTo(0, 6);

    const depthAnnotation = overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'depthM');
    expect(depthAnnotation?.witnessStart.x).toBeCloseTo(5, 6);
    expect(depthAnnotation?.witnessStart.y).toBeCloseTo(0, 6);
    expect(depthAnnotation?.witnessEnd.x).toBeCloseTo(5, 6);
    expect(depthAnnotation?.witnessEnd.y).toBeCloseTo(4, 6);
  });

  it('uses relationship dimensions instead of a center offset annotation when the selected deck is intentionally offset', () => {
    const baseHouse = makeHouse();
    const deck = makeDeck({
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0.5',
      },
    });
    const resolvedDeck = resolveDeckPresetGeometry({
      deck,
      housePolygon: baseHouse.footprint.polygon,
    });
    const house = makeHouse({
      decks: [
        {
          ...deck,
          presetRect: resolvedDeck.presetRect,
          outline: resolvedDeck.outline,
        },
      ],
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'deck', targetId: 'deck-1' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.presetAnnotations.find((annotation) => annotation.fieldKey === 'centerOffsetM')).toBeUndefined();
    expect(overlay?.presetAnnotations.map((annotation) => annotation.fieldKey)).toEqual(
      expect.arrayContaining(['hostStartGapM', 'hostEndGapM']),
    );
  });

  it('builds custom edge candidates for selected custom polygons without preset annotations', () => {
    const house = makeHouse({
      footprint: {
        mode: 'custom_polygon',
        preset: 'straight',
        polygon: [
          { alongM: '0', depthM: '0' },
          { alongM: '6', depthM: '0' },
          { alongM: '6', depthM: '2.4' },
          { alongM: '0', depthM: '2.4' },
        ],
      },
    });

    const overlay = buildHouseFirstPlanOverlay({
      house,
      selection: { kind: 'footprint', targetId: 'house-main' },
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(overlay?.presetAnnotations).toEqual([]);
    expect(overlay?.customEdgeCandidates).toHaveLength(4);
    expect(overlay?.customEdgeCandidates[0]).toMatchObject({
      targetKind: 'house_custom_edge',
      ownerId: 'house-main',
      edgeIndex: 0,
      rawValue: '6',
      displayValue: '6.00m',
    });
  });

  it('resizes a custom edge while preserving direction, midpoint, and winding', () => {
    const polygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '4', depthM: '0' },
      { alongM: '4', depthM: '2' },
      { alongM: '0', depthM: '2' },
    ];

    const resized = resizeCustomPolygonEdge({
      polygon,
      edgeIndex: 0,
      nextLengthM: '6',
    });

    expect(resized).toEqual([
      { alongM: '-1', depthM: '0' },
      { alongM: '5', depthM: '0' },
      { alongM: '4', depthM: '2' },
      { alongM: '0', depthM: '2' },
    ]);
    expect((Number(resized?.[0]?.alongM) + Number(resized?.[1]?.alongM)) / 2).toBeCloseTo(2, 6);
    expect(Number(resized?.[0]?.depthM)).toBeCloseTo(Number(resized?.[1]?.depthM ?? '0'), 6);
    expect(Math.sign(signedArea(resized ?? []))).toBe(Math.sign(signedArea(polygon)));
  });

  it('rejects custom edge resizes that would create an invalid polygon', () => {
    const polygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '5', depthM: '0' },
      { alongM: '5', depthM: '5' },
      { alongM: '3', depthM: '5' },
      { alongM: '3', depthM: '2' },
      { alongM: '2', depthM: '2' },
      { alongM: '2', depthM: '5' },
      { alongM: '0', depthM: '5' },
    ];

    const resized = resizeCustomPolygonEdge({
      polygon,
      edgeIndex: 4,
      nextLengthM: '6',
    });

    expect(resized).toBeNull();
  });
});
