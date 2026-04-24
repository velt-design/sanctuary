import { deriveHouseRoofCapabilities } from '@sp/geometry';
import { makeDefaultHouseFootprintParams } from '@/lib/types/calculator';
import {
  buildEstimateDrawingDraftFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import type {
  DeckModel,
  WorkbenchProjectModel,
} from './houseFirstWorkbenchModel';

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

export function makeHouseFirstOnePergolaFixture(): WorkbenchProjectModel {
  const roofFootprint = [
    { x: 0, y: -3000, z: 0 },
    { x: 6000, y: -3000, z: 0 },
    { x: 6000, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
  return {
    source: 'legacy_estimate_snapshot',
    house: {
      id: 'house-main',
      label: 'House',
      confidence: 'high',
      lowConfidence: false,
      sourceModuleIndexes: [0],
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
        appendage: {
          enabled: false,
          form: 'mono',
          hostEdge: 'rear',
          pitchDeg: '5',
          dropMm: '450',
        },
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
      decks: [],
      openings: [],
      attachmentZones: [{ id: 'zone-soffit-rear', label: 'Rear soffit', kind: 'soffit', side: 'rear' }],
    },
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
          houseAttachmentZoneId: 'zone-soffit-rear',
          side: 'rear',
          strategy: 'soffit_brackets',
        },
      },
    ],
    warnings: [],
  };
}

export function makeHouseFirstTwoPergolaSharedHouseFixture(): WorkbenchProjectModel {
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
          houseAttachmentZoneId: 'zone-soffit-rear',
          side: 'rear',
          strategy: 'soffit_brackets',
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
  projectModel: WorkbenchProjectModel;
} {
  const projectModel = structuredClone(makeHouseFirstOnePergolaFixture());
  let activeHostSide: 'rear' | 'front' | 'left' | 'right' = 'rear';

  switch (input.id) {
    case 'rear_threshold_attached':
      projectModel.house!.decks = [
        makeDeckModel({
          id: 'deck-rear-threshold',
          hostEdgeId: 'rear',
        }),
      ];
      break;
    case 'left_threshold_attached':
      activeHostSide = 'left';
      projectModel.house!.footprint.attachmentSide = 'left';
      projectModel.house!.attachmentZones = [
        { id: 'zone-soffit-left', label: 'Left soffit', kind: 'soffit', side: 'left' },
      ];
      projectModel.pergolas[0]!.attachment = {
        ...projectModel.pergolas[0]!.attachment,
        houseAttachmentZoneId: 'zone-soffit-left',
        side: 'left',
      };
      projectModel.house!.decks = [
        makeDeckModel({
          id: 'deck-left-threshold',
          hostEdgeId: 'left',
        }),
      ];
      break;
    case 'detached_rear_near_house':
      projectModel.house!.decks = [
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
      projectModel.house!.decks = [
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
      projectModel.house!.decks = [
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
      projectModel.house!.decks = [
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

  if (id === 'rear_threshold_attached') {
    draft.houseFirst = {
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
    draft.houseFirst = {
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
    draft.houseFirst = {
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
    draft.houseFirst = {
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
    draft.houseFirst = {
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

  return {
    snapshot,
    draft,
  };
}
