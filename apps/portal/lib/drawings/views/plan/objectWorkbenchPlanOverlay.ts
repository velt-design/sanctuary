import type { ModulePlanHouseContext } from '@/app/staff/calculator/moduleViews';
import type {
  DeckModel,
  HouseModel,
  WallOpeningModel,
  WorkbenchHouseSelection,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type {
  DeckObjectModel,
  HouseAssemblyModel,
  HouseFormModel,
  OpeningObjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchStatusFacade } from '@/lib/drawings/state/objectWorkbenchStatusModel';
import {
  buildHouseFirstPlanOverlay,
  resizeCustomPolygonEdge as resizeObjectWorkbenchCustomPolygonEdge,
} from './houseFirstPlanOverlay';

export type {
  HouseFirstPlanCustomEdgeCandidate as ObjectWorkbenchPlanCustomEdgeCandidate,
  HouseFirstPlanDeckCrossEdgeReference as ObjectWorkbenchPlanDeckCrossEdgeReference,
  HouseFirstPlanDeckInteraction as ObjectWorkbenchPlanDeckInteraction,
  HouseFirstPlanDeckReferenceFrame as ObjectWorkbenchPlanDeckReferenceFrame,
  HouseFirstPlanHousePolygonSource as ObjectWorkbenchPlanHousePolygonSource,
  HouseFirstPlanOpeningInteraction as ObjectWorkbenchPlanOpeningInteraction,
  HouseFirstPlanOverlay as ObjectWorkbenchPlanOverlay,
  HouseFirstPlanPresetDimensionAnnotation as ObjectWorkbenchPlanPresetDimensionAnnotation,
  HouseFirstPlanShapeOverlay as ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from './houseFirstPlanOverlay';

export { resizeObjectWorkbenchCustomPolygonEdge };

export type ObjectWorkbenchPlanOverlaySelection = {
  kind: 'house' | 'footprint' | 'roof' | 'deck' | 'opening' | 'attachment_zone';
  targetId: string | null;
};

export type ObjectWorkbenchPlanOverlayInput = {
  houseAssembly: HouseAssemblyModel | null;
  houseForm: HouseFormModel | null;
  decks: DeckObjectModel[];
  openings: OpeningObjectModel[];
  selection: ObjectWorkbenchPlanOverlaySelection;
  moduleLengthM?: string | null;
  moduleProjectionM?: string | null;
  geometryHouseContext: ModulePlanHouseContext | null | undefined;
  status: ObjectWorkbenchStatusFacade;
};

function toCompatibilityDeck(
  deck: DeckObjectModel,
  status: ObjectWorkbenchStatusFacade,
): DeckModel {
  const deckStatus = status.deckStatuses[deck.id] ?? null;
  return {
    id: deck.id,
    name: deck.label,
    kind: deck.kind,
    shape: deck.shape,
    presetType: deck.presetType,
    presetRect: deck.presetRect ?? null,
    floatingRect: deck.floatingRect ?? null,
    outline: deck.outline,
    elevationMode: deck.elevationMode,
    levelOffsetMm: deck.levelOffsetMm,
    hostEdgeId: deck.hostEdgeId,
    ...(deck.attachmentMode ? { attachmentMode: deck.attachmentMode } : null),
    ...(deck.primaryHostEdgeId ? { primaryHostEdgeId: deck.primaryHostEdgeId } : null),
    ...(deck.secondaryHostEdgeId ? { secondaryHostEdgeId: deck.secondaryHostEdgeId } : null),
    ...(deck.cornerVertexId ? { cornerVertexId: deck.cornerVertexId } : null),
    isAttached: deck.isAttached,
    surfaceMaterial: deck.surfaceMaterial,
    topSurfaceElevationMm: 0,
    supportContext: {
      classification: 'ground_supported',
      nearestHouseEdgeId: deck.hostEdgeId,
      nearestHouseEdgeDistanceMm: null,
      attachmentContactLengthMm: null,
      warningCodes: deckStatus?.supportWarnings.codes ?? [],
      warningMessages: deckStatus?.supportWarnings.messages ?? [],
    },
    validation: {
      status: deckStatus?.validation.status ?? 'valid',
      codes: deckStatus?.validation.codes ?? [],
      messages: deckStatus?.validation.messages ?? [],
      message: deckStatus?.validation.message ?? null,
    },
  } as DeckModel;
}

function toCompatibilityOpening(
  opening: OpeningObjectModel,
  status: ObjectWorkbenchStatusFacade,
): WallOpeningModel {
  const openingStatus = status.openingStatuses[opening.id] ?? null;
  return {
    id: opening.id,
    label: opening.label,
    kind: opening.kind,
    panelCount: opening.panelCount,
    hostWallId: opening.hostWallId,
    wallId: opening.wallId ?? null,
    hostEdgeId: opening.hostEdgeId ?? null,
    widthM: opening.widthM,
    heightM: opening.heightM,
    sillHeightM: opening.sillHeightM,
    offsetAlongWallM: opening.offsetAlongWallM,
    validation: {
      status: openingStatus?.validation.status ?? 'valid',
      codes: openingStatus?.validation.codes ?? [],
      message: openingStatus?.validation.message ?? null,
    },
  } as WallOpeningModel;
}

function buildCompatibilityHouse(input: ObjectWorkbenchPlanOverlayInput): HouseModel | null {
  const houseForm = input.houseForm ?? input.houseAssembly?.houseForms[0] ?? null;
  if (!houseForm) return null;

  return {
    id: houseForm.id,
    label: houseForm.label,
    confidence: input.status.houseForm.lowConfidence ? 'low' : 'high',
    lowConfidence: input.status.houseForm.lowConfidence,
    sourceModuleIndexes: houseForm.sourceModuleIndexes ?? [],
    sourceModuleIds: houseForm.sourceModuleIds ?? [],
    footprint: {
      mode: houseForm.footprint.mode,
      preset: houseForm.footprint.preset,
      params: houseForm.footprint.params,
      polygon: houseForm.footprint.polygon,
      drawingRotationQuarterTurns: houseForm.transform.rotationQuarterTurns,
      attachmentSide: houseForm.footprint.attachmentSide,
    },
    roof: {
      id: `${houseForm.id}:roof`,
      form: houseForm.roofIntent.form,
      material: houseForm.roofIntent.material,
      pitchDeg: houseForm.roofIntent.primaryPitchDeg,
      primaryPitchDeg: houseForm.roofIntent.primaryPitchDeg,
      primaryFallDirection: houseForm.roofIntent.primaryFallDirection,
      ridgeAxis: houseForm.roofIntent.ridgeAxis,
      openGableEndIds: houseForm.roofIntent.openGableEndIds,
      terminalEnds:
        input.status.houseForm.roof?.terminalEnds.map((end) => ({
          ...end,
          sourceEdgeId: end.id,
        })) ?? [],
      appendage: houseForm.roofIntent.appendage,
      geometryKind: input.status.houseForm.roof?.geometryKind ?? null,
      appendageSupportedHostEdges: input.status.houseForm.roof?.appendageSupportedHostEdges ?? [],
      appendageSupportReason: input.status.houseForm.roof?.appendageSupportReason ?? null,
      validation: {
        status: input.status.houseForm.roof?.validationStatus ?? 'valid',
        code: input.status.houseForm.roof?.validationCode ?? null,
        message: input.status.houseForm.roof?.validationMessage ?? null,
        approximationReasons: input.status.houseForm.roof?.approximationReasons ?? [],
      },
      provenance: input.status.houseForm.roof?.provenance ?? {},
      capabilities: {
        controls: input.status.houseForm.roof?.controls ?? {},
        footprintTopology: 'orthogonal_rectilinear',
        selectedFormFootprintRequirement: 'any_rectilinear',
        selectedFormSupported: input.status.houseForm.roof?.selectedFormSupported ?? true,
        appendageSupported: input.status.houseForm.roof?.appendageSupported ?? false,
      },
      confidence: input.status.houseForm.lowConfidence ? 'low' : 'high',
      source: 'house_first_draft',
    } as HouseModel['roof'],
    storeyMode: houseForm.storeyMode,
    attachmentStrategy: houseForm.attachmentStrategy,
    eaveHeightM: houseForm.eaveHeightM ?? '',
    wallHeightM: houseForm.wallHeightM ?? '',
    soffitDepthMm: houseForm.soffitDepthMm ?? '',
    fasciaHeightMm: houseForm.fasciaHeightMm ?? '',
    gutterWidthMm: houseForm.gutterWidthMm ?? '',
    gutterDepthMm: houseForm.gutterDepthMm ?? '',
    gutterProjectionMm: houseForm.gutterProjectionMm ?? '',
    eaveOverhangMm: houseForm.eaveOverhangMm ?? '',
    derivedEnvelope: input.houseAssembly?.derivedEnvelope ?? null,
    derivedWallGraph: input.houseAssembly?.derivedEnvelope?.wallGraph ?? {
      walls: [],
      mergeGroups: [],
    },
    decks: input.decks.map((deck) => toCompatibilityDeck(deck, input.status)),
    openings: input.openings.map((opening) => toCompatibilityOpening(opening, input.status)),
    attachmentZones:
      input.houseAssembly?.derivedEnvelope?.attachmentZones.map((zone) => ({
        id: zone.id,
        label: zone.label,
        kind: zone.kind,
        side: zone.side,
      })) ?? [],
    attachmentZoneDiagnostics: {
      blocked: [],
    },
  };
}

export function buildObjectWorkbenchPlanOverlay(input: ObjectWorkbenchPlanOverlayInput) {
  return buildHouseFirstPlanOverlay({
    house: buildCompatibilityHouse(input),
    selection: input.selection as WorkbenchHouseSelection,
    moduleLengthM: input.moduleLengthM,
    moduleProjectionM: input.moduleProjectionM,
    geometryHouseContext: input.geometryHouseContext,
  });
}
