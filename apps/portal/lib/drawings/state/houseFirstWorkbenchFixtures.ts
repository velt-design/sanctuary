import { deriveHouseRoofCapabilities } from '@sp/geometry';
import { makeDefaultHouseFootprintParams } from '@/lib/types/calculator';
import {
  buildEstimateDrawingDraftFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import type {
  DeckModel,
  HouseFirstWorkbenchProjectModel,
} from './houseFirstWorkbenchModel';
import { buildHouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchAdapter';

// PR-C (2026-05-22): the previously-exported `LEGACY_PRIMARY_HOUSE_FORM_ID`
// constant is gone. Test fixtures inline the literal id string the
// synthesized primary form gets assigned. If `buildSharedHouse` ever
// changes the synthesized id, update this single source.
const SYNTHESIZED_PRIMARY_FORM_ID = 'house-main';
const LEGACY_PRIMARY_HOUSE_FORM_ID = SYNTHESIZED_PRIMARY_FORM_ID;
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from './objectFirstWorkbenchAdapter';
import {
  buildObjectFirstWorkbenchProjectModel,
} from './legacyObjectFirstCompatibilityAdapter';

const FIXTURE_WALLS = [
  {
    id: 'wall-footprint-edge-1',
    label: 'Rear wall',
    sourceFormIds: [LEGACY_PRIMARY_HOUSE_FORM_ID],
    edgeIds: ['footprint-edge-1'],
    kind: 'exterior' as const,
    polygon: [
      { alongM: '0', depthM: '-3' },
      { alongM: '6', depthM: '-3' },
    ],
  },
  {
    id: 'wall-footprint-edge-2',
    label: 'Right wall',
    sourceFormIds: [LEGACY_PRIMARY_HOUSE_FORM_ID],
    edgeIds: ['footprint-edge-2'],
    kind: 'exterior' as const,
    polygon: [
      { alongM: '6', depthM: '-3' },
      { alongM: '6', depthM: '0' },
    ],
  },
  {
    id: 'wall-footprint-edge-3',
    label: 'Front wall',
    sourceFormIds: [LEGACY_PRIMARY_HOUSE_FORM_ID],
    edgeIds: ['footprint-edge-3'],
    kind: 'exterior' as const,
    polygon: [
      { alongM: '6', depthM: '0' },
      { alongM: '0', depthM: '0' },
    ],
  },
  {
    id: 'wall-footprint-edge-4',
    label: 'Left wall',
    sourceFormIds: [LEGACY_PRIMARY_HOUSE_FORM_ID],
    edgeIds: ['footprint-edge-4'],
    kind: 'exterior' as const,
    polygon: [
      { alongM: '0', depthM: '0' },
      { alongM: '0', depthM: '-3' },
    ],
  },
];

function buildFixtureDerivedEnvelope(input?: {
  zoneSide?: 'rear' | 'front' | 'left' | 'right';
  zoneKind?: 'wall' | 'soffit' | 'fascia' | 'roof_edge';
}) {
  const zoneSide = input?.zoneSide ?? 'rear';
  const zoneKind = input?.zoneKind ?? 'soffit';
  const hostEdgeId =
    zoneSide === 'rear'
      ? 'footprint-edge-1'
      : zoneSide === 'right'
        ? 'footprint-edge-2'
        : zoneSide === 'front'
          ? 'footprint-edge-3'
          : 'footprint-edge-4';
  const hostWallId = `wall-${hostEdgeId}`;
  const hostWallLabel =
    FIXTURE_WALLS.find((wall) => wall.id === hostWallId)?.label ??
    `${zoneSide.charAt(0).toUpperCase()}${zoneSide.slice(1)} wall`;
  return {
    mergedFormIds: [LEGACY_PRIMARY_HOUSE_FORM_ID],
    footprint: [],
    wallGraph: {
      walls: FIXTURE_WALLS,
      mergeGroups: [],
    },
    roofZones: [],
    edges: FIXTURE_WALLS.map((wall) => ({
      id: wall.edgeIds[0]!,
      label: wall.label,
      semanticKind: 'wall_perimeter' as const,
      sourceFormIds: [LEGACY_PRIMARY_HOUSE_FORM_ID],
      hostWallId: wall.id,
      hostRoofZoneIds: [],
      start: wall.polygon[0]!,
      end: wall.polygon[1]!,
    })),
    attachmentZones: [
      {
        id: `zone-${zoneKind}-${hostEdgeId}`,
        label: `${hostWallLabel} ${zoneKind.replace('_', ' ')}`,
        kind: zoneKind,
        side: zoneSide,
        sourceFormIds: [LEGACY_PRIMARY_HOUSE_FORM_ID],
        hostWallId,
        hostEdgeId,
        hostRoofZoneId: null,
      },
    ],
  };
}

function makeBaseLegacySnapshot() {
  return {
    inputs: {
      schemaVersion: 'v2',
      projectName: 'House First Fixture Project',
      quoteRef: 'Q-HF-1000',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [
        { id: 'pergola-1', label: 'Pergola 1' },
        { id: 'pergola-2', label: 'Pergola 2' },
      ],
      modules: [
        {
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
          attachmentSide: 'rear',
          houseFootprintMode: 'preset',
          houseFootprintPreset: 'straight',
          houseFootprintParams: makeDefaultHouseFootprintParams(),
          houseFootprintPolygon: [],
          houseStoreyMode: 'single_storey',
          houseRoofMaterial: 'corrugated_iron',
          houseAttachmentStrategy: 'soffit_brackets',
          houseEaveHeightM: '2.7',
          houseWallHeightM: '2.4',
          houseRoofPitchDeg: '22.5',
          houseSoffitDepthMm: '450',
          houseFasciaHeightMm: '180',
          houseGutterWidthMm: '130',
          houseGutterDepthMm: '120',
          houseGutterProjectionMm: '95',
          houseEaveOverhangMm: '450',
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
        },
      ],
    },
    outputs: {
      pergolas: [
        {
          id: 'pergola-1',
          modules: [
            {
              derived: {
                length_m: 6,
                projection_m: 3,
              },
            },
          ],
        },
      ],
    },
  } satisfies Record<string, unknown>;
}

export function makeHouseFirstOnePergolaFixture(): HouseFirstWorkbenchProjectModel {
  const roofFootprint = [
    { x: 0, y: -3000, z: 0 },
    { x: 6000, y: -3000, z: 0 },
    { x: 6000, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
  return {
    source: 'legacy_estimate_snapshot',
    houseForms: [{
      id: LEGACY_PRIMARY_HOUSE_FORM_ID,
      label: 'House',
      confidence: 'high',
      lowConfidence: false,
      sourceModuleIndexes: [0],
      transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
      sourceModuleIds: ['module-1'],
      footprint: {
        mode: 'preset',
        preset: 'straight',
        params: makeDefaultHouseFootprintParams(),
        polygon: [],
        drawingRotationQuarterTurns: 0,
        attachmentSide: 'rear',
      },
      roof: {
        id: 'house-roof-main',
        form: 'mono',
        material: 'corrugated_iron',
        pitchDeg: '22.5',
        primaryPitchDeg: '22.5',
        primaryFallDirection: 'positive_y',
        ridgeAxis: 'x',
        openGableEndIds: [],
        terminalEnds: [],
        appendage: {
          enabled: false,
          form: 'mono',
          hostEdge: 'rear',
          pitchDeg: '5',
          dropMm: '450',
        },
        geometryKind: null,
        appendageSupportedHostEdges: ['rear', 'front', 'left', 'right'],
        appendageSupportReason: null,
        validation: {
          status: 'valid',
          code: null,
          message: null,
        },
        capabilities: deriveHouseRoofCapabilities({
          roofForm: 'mono',
          footprint: roofFootprint,
        }),
        confidence: 'high',
        source: 'legacy_shared_value',
      },
      storeyMode: 'single_storey',
      attachmentStrategy: 'soffit_brackets',
      eaveHeightM: '2.7',
      wallHeightM: '2.4',
      soffitDepthMm: '450',
      fasciaHeightMm: '180',
      gutterWidthMm: '130',
      gutterDepthMm: '120',
      gutterProjectionMm: '95',
      eaveOverhangMm: '450',
      derivedEnvelope: buildFixtureDerivedEnvelope(),
      derivedWallGraph: {
        walls: FIXTURE_WALLS,
        mergeGroups: [],
      },
      decks: [],
      openings: [],
      attachmentZones: [
        {
          id: 'zone-soffit-footprint-edge-1',
          label: 'Rear wall soffit',
          kind: 'soffit',
          side: 'rear',
        },
      ],
      attachmentZoneDiagnostics: { blocked: [] },
    }],
    pergolas: [
      {
        id: 'pergola-1',
        label: 'Pergola 1',
        family: 'mono',
        confidence: 'high',
        sourceModuleIndexes: [0],
        sourceModuleIds: ['module-1'],
        attachment: {
          id: 'attachment-pergola-1',
          kind: 'soffit',
          attachmentEdgeId: 'footprint-edge-1',
          attachmentZoneId: 'zone-soffit-footprint-edge-1',
          houseAttachmentZoneId: 'zone-soffit-footprint-edge-1',
          side: 'rear',
          strategy: 'soffit_brackets',
          resolution: {
            status: 'resolved',
            message: null,
          },
        },
      },
    ],
    warnings: [],
  };
}

export function makeHouseFirstTwoPergolaSharedHouseFixture(): HouseFirstWorkbenchProjectModel {
  const base = makeBaseLegacySnapshot();
  const modules = (base.inputs as { modules: Array<Record<string, unknown>> }).modules;
  modules.push({
    ...structuredClone(modules[0]),
    pergolaId: 'pergola-2',
    lengthM: '4.8',
    projectionM: '2.7',
  });
  return {
    ...makeHouseFirstOnePergolaFixture(),
    pergolas: [
      makeHouseFirstOnePergolaFixture().pergolas[0]!,
      {
        id: 'pergola-2',
        label: 'Pergola 2',
        family: 'mono',
        confidence: 'high',
        sourceModuleIndexes: [1],
        sourceModuleIds: ['module-2'],
        attachment: {
          id: 'attachment-pergola-2',
          kind: 'soffit',
          attachmentEdgeId: 'footprint-edge-1',
          attachmentZoneId: 'zone-soffit-footprint-edge-1',
          houseAttachmentZoneId: 'zone-soffit-footprint-edge-1',
          side: 'rear',
          strategy: 'soffit_brackets',
          resolution: {
            status: 'resolved',
            message: null,
          },
        },
      },
    ],
  };
}

export function makeHouseFirstConflictingLegacyContextFixture(): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft | null;
} {
  const snapshot = makeBaseLegacySnapshot();
  const inputs = snapshot.inputs as {
    modules: Array<Record<string, unknown>>;
    pergolas: Array<{ id: string; label: string }>;
  };
  inputs.pergolas = [
    { id: 'pergola-1', label: 'Pergola 1' },
    { id: 'pergola-2', label: 'Pergola 2' },
  ];
  inputs.modules = [
    structuredClone(inputs.modules[0]!),
    {
      ...structuredClone(inputs.modules[0]!),
      pergolaId: 'pergola-2',
      houseFootprintPreset: 'u_shape',
      houseRoofMaterial: 'shingles',
      houseRoofPitchDeg: '30',
    },
  ];
  return {
    snapshot,
    draft: null,
  };
}

export type HouseFirstDeckSupportFixtureId =
  | 'rear_threshold_attached'
  | 'left_threshold_attached'
  | 'detached_rear_near_house'
  | 'rear_wrap_multi_edge'
  | 'left_non_relevant_when_rear_active'
  | 'rear_warning_heavy_attached';

function makeDeckModel(
  overrides: Partial<DeckModel> & Pick<DeckModel, 'id' | 'hostEdgeId'>,
): DeckModel {
  return {
    id: overrides.id,
    name: overrides.name ?? 'Fixture Deck',
    kind: overrides.kind ?? 'deck',
    shape: overrides.shape ?? 'preset',
    presetType: overrides.presetType ?? 'rect_attached',
    presetRect:
      overrides.presetRect ??
      {
        widthM: '3.6',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: null,
      },
    outline:
      overrides.outline ??
      [
        { alongM: '0', depthM: '0' },
        { alongM: '3.6', depthM: '0' },
        { alongM: '3.6', depthM: '3' },
        { alongM: '0', depthM: '3' },
      ],
    elevationMode: overrides.elevationMode ?? 'aligned_to_threshold',
    levelOffsetMm: overrides.levelOffsetMm ?? '0',
    hostEdgeId: overrides.hostEdgeId,
    isAttached: overrides.isAttached ?? true,
    surfaceMaterial: overrides.surfaceMaterial ?? 'timber_decking',
    topSurfaceElevationMm: overrides.topSurfaceElevationMm ?? 0,
    supportContext:
      overrides.supportContext ??
      {
        classification: 'threshold_attached',
        nearestHouseEdgeId: overrides.hostEdgeId,
        nearestHouseEdgeDistanceMm: 0,
        attachmentContactLengthMm: 3600,
        warningCodes: [],
        warningMessages: [],
      },
    validation:
      overrides.validation ??
      {
        status: 'valid',
        codes: [],
        messages: [],
        message: null,
      },
  };
}

export function makeHouseFirstDeckSupportProjectFixture(input: {
  id: HouseFirstDeckSupportFixtureId;
}): {
  activeHostSide: 'rear' | 'front' | 'left' | 'right';
  projectModel: HouseFirstWorkbenchProjectModel;
} {
  const projectModel = structuredClone(makeHouseFirstOnePergolaFixture());
  let activeHostSide: 'rear' | 'front' | 'left' | 'right' = 'rear';

  switch (input.id) {
    case 'rear_threshold_attached':
      projectModel.houseForms[0]!.decks = [
        makeDeckModel({
          id: 'deck-rear-threshold',
          hostEdgeId: 'rear',
        }),
      ];
      break;
    case 'left_threshold_attached':
      activeHostSide = 'left';
      projectModel.houseForms[0]!.footprint.attachmentSide = 'left';
      projectModel.houseForms[0]!.derivedEnvelope = buildFixtureDerivedEnvelope({
        zoneSide: 'left',
      });
      projectModel.houseForms[0]!.derivedWallGraph = projectModel.houseForms[0]!.derivedEnvelope.wallGraph;
      projectModel.houseForms[0]!.attachmentZones = [
        { id: 'zone-soffit-footprint-edge-4', label: 'Left wall soffit', kind: 'soffit', side: 'left' },
      ];
      projectModel.houseForms[0]!.attachmentZoneDiagnostics = { blocked: [] };
      projectModel.pergolas[0]!.attachment = {
        ...projectModel.pergolas[0]!.attachment,
        attachmentEdgeId: 'footprint-edge-4',
        attachmentZoneId: 'zone-soffit-footprint-edge-4',
        houseAttachmentZoneId: 'zone-soffit-footprint-edge-4',
        side: 'left',
      };
      projectModel.houseForms[0]!.decks = [
        makeDeckModel({
          id: 'deck-left-threshold',
          hostEdgeId: 'left',
        }),
      ];
      break;
    case 'detached_rear_near_house':
      projectModel.houseForms[0]!.decks = [
        makeDeckModel({
          id: 'deck-rear-detached-near',
          hostEdgeId: 'rear',
          isAttached: false,
          presetType: 'rect_detached',
          elevationMode: 'ground',
          levelOffsetMm: '120',
          topSurfaceElevationMm: 120,
          supportContext: {
            classification: 'ground_supported',
            nearestHouseEdgeId: 'rear',
            nearestHouseEdgeDistanceMm: 150,
            attachmentContactLengthMm: 0,
            warningCodes: ['detached_too_close_to_house'],
            warningMessages: ['Deck is detached but still sits very close to the house edge.'],
          },
        }),
      ];
      break;
    case 'rear_wrap_multi_edge':
      projectModel.houseForms[0]!.decks = [
        makeDeckModel({
          id: 'deck-rear-wrap',
          hostEdgeId: 'rear',
          supportContext: {
            classification: 'threshold_attached',
            nearestHouseEdgeId: 'left',
            nearestHouseEdgeDistanceMm: 0,
            attachmentContactLengthMm: 4200,
            warningCodes: [],
            warningMessages: [],
          },
        }),
      ];
      break;
    case 'left_non_relevant_when_rear_active':
      projectModel.houseForms[0]!.decks = [
        makeDeckModel({
          id: 'deck-left-only',
          hostEdgeId: 'left',
          supportContext: {
            classification: 'threshold_attached',
            nearestHouseEdgeId: 'left',
            nearestHouseEdgeDistanceMm: 0,
            attachmentContactLengthMm: 3200,
            warningCodes: [],
            warningMessages: [],
          },
        }),
      ];
      break;
    case 'rear_warning_heavy_attached':
      projectModel.houseForms[0]!.decks = [
        makeDeckModel({
          id: 'deck-rear-warning',
          hostEdgeId: 'rear',
          supportContext: {
            classification: 'threshold_attached',
            nearestHouseEdgeId: 'rear',
            nearestHouseEdgeDistanceMm: 0,
            attachmentContactLengthMm: 900,
            warningCodes: ['threshold_alignment_offset', 'insufficient_host_edge_contact'],
            warningMessages: [
              'Threshold-aligned decks should normally stay within 10 mm of the host threshold.',
              'Attached deck contact along the host edge is very short.',
            ],
          },
        }),
      ];
      break;
  }

  return {
    activeHostSide,
    projectModel,
  };
}

export function makeHouseFirstDeckSupportSnapshotFixture(
  id:
    | 'rear_threshold_attached'
    | 'left_threshold_attached'
    | 'detached_rear_near_house'
    | 'left_non_relevant_when_rear_active'
    | 'rear_warning_heavy_attached',
): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
} {
  const snapshot = makeBaseLegacySnapshot();
  const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
  if (!draft) {
    throw new Error('Expected drawing draft from base fixture snapshot.');
  }
  const module = draft.inputs.modules[0];
  if (!module) {
    throw new Error('Expected fixture module.');
  }

  if (id === 'left_threshold_attached') {
    module.attachmentSide = 'left';
  } else {
    module.attachmentSide = 'rear';
  }
  const draftWithHouseFirst = draft as EstimateDrawingDraft & { houseFirst?: unknown };

  if (id === 'rear_threshold_attached') {
    draftWithHouseFirst.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Rear attached deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '3.6',
            depthM: '3',
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
    };
  } else if (id === 'left_threshold_attached') {
    draftWithHouseFirst.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Left attached deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '3.6',
            depthM: '3',
            centerOffsetM: '0',
            detachedGapM: null,
          },
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'left',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
      ],
    };
  } else if (id === 'detached_rear_near_house') {
    draftWithHouseFirst.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Detached rear deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_detached',
          presetRect: {
            widthM: '3.6',
            depthM: '3',
            centerOffsetM: '0',
            detachedGapM: '0.05',
          },
          elevationMode: 'ground',
          levelOffsetMm: '120',
          hostEdgeId: 'rear',
          isAttached: false,
          surfaceMaterial: 'composite',
        },
      ],
    };
  } else if (id === 'left_non_relevant_when_rear_active') {
    draftWithHouseFirst.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Left deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '3.6',
            depthM: '3',
            centerOffsetM: '0',
            detachedGapM: null,
          },
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'left',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
      ],
    };
  } else if (id === 'rear_warning_heavy_attached') {
    draftWithHouseFirst.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Rear warning deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '0.15',
            depthM: '3',
            centerOffsetM: '0',
            detachedGapM: null,
          },
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '700',
          hostEdgeId: 'rear',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
      ],
    };
  }

  const compatibilityProjectModel = buildHouseFirstWorkbenchProjectModel({
    snapshot,
    draft,
  });
  const objectFirstProjectModel = buildObjectFirstWorkbenchProjectModel({
    compatibilityProjectModel,
  });
  draft.objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(objectFirstProjectModel);

  return {
    snapshot,
    draft,
  };
}
