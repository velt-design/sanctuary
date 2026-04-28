import type {
  HouseRoofCapabilities,
  HouseRoofFootprintRequirement,
  HouseRoofFootprintTopology,
} from '@sp/geometry';
import type {
  CalculatorDrawingRotationQuarterTurns,
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseFootprintMode,
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
  CalculatorHouseFootprintPreset,
  CalculatorHouseRoofMaterial,
  CalculatorHouseStoreyMode,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';

export type WorkbenchMode = 'house' | 'pergolas';
export type HouseRoofForm = 'flat' | 'mono' | 'gable' | 'hipped';
export type HouseRoofPrimaryFallDirection = 'positive_x' | 'negative_x' | 'positive_y' | 'negative_y';
export type HouseRoofRidgeAxis = 'x' | 'y';
export type HouseRoofAppendageForm = 'flat' | 'mono';
export type HouseRoofFieldSource =
  | 'house_first_draft'
  | 'legacy_shared_value'
  | 'legacy_pergola_inference'
  | 'default_fallback';
export type HouseRoofApproximationReason =
  | 'inferred_form'
  | 'inferred_fall_direction'
  | 'inferred_ridge_axis'
  | 'ambiguous_ridge_axis';
export type HouseRoofProvenance = {
  form: HouseRoofFieldSource;
  material: HouseRoofFieldSource;
  primaryPitchDeg: HouseRoofFieldSource;
  primaryFallDirection: HouseRoofFieldSource;
  ridgeAxis: HouseRoofFieldSource;
  openGableEndIds: HouseRoofFieldSource;
  appendage: HouseRoofFieldSource;
};
export type DeckKind = 'deck' | 'landing';
export type DeckShape = 'preset' | 'custom';
export type DeckPlacementMode = 'snapped' | 'floating';
// `rect_attached` / `rect_detached` remain the legacy persistence values in PR1.
// They are not the long-term canonical placement semantics for preset decks.
export type DeckPresetType = 'rect_attached' | 'rect_detached';
export type DeckElevationMode = 'ground' | 'stepped' | 'aligned_to_threshold';
export type DeckSurfaceMaterial = 'timber_decking' | 'composite' | 'concrete';
export type DeckPresetRect = {
  widthM: string;
  depthM: string;
  centerOffsetM: string;
  detachedGapM?: string | null;
};
export type DeckFloatingPresetRect = {
  centerAlongM: string;
  centerDepthM: string;
  widthM: string;
  depthM: string;
};
export type DeckSupportClassification = 'ground_supported' | 'threshold_attached' | 'mixed_or_unclear';
export function resolveDeckPlacementMode(isAttached: boolean): DeckPlacementMode {
  return isAttached ? 'snapped' : 'floating';
}
export type DeckSupportWarningCode =
  | 'insufficient_host_edge_contact'
  | 'detached_too_close_to_house'
  | 'threshold_alignment_offset'
  | 'unsupported_house_intersection';
export type DeckValidationCode =
  | 'self_intersecting_outline'
  | 'outline_inside_house'
  | 'attached_missing_host_edge'
  | 'overlapping_decks'
  | 'detached_threshold_alignment'
  | 'unsupported_house_intersection';
export type WallOpeningKind = 'window' | 'hinged_door' | 'slider' | 'stacker';
export const WALL_OPENING_KINDS = ['window', 'hinged_door', 'slider', 'stacker'] as const;
export type SliderPanelCount = 2 | 3 | 4;
export const SLIDER_PANEL_COUNTS = [2, 3, 4] as const;
export type WallOpeningHostSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;
export type WallOpeningValidationCode =
  | 'missing_host_wall'
  | 'invalid_width'
  | 'invalid_height'
  | 'invalid_sill_height'
  | 'offset_out_of_bounds'
  | 'span_exceeds_wall'
  | 'insufficient_corner_clearance'
  | 'overlapping_openings';
export type HouseAttachmentZoneKind = 'wall' | 'soffit' | 'fascia' | 'roof_edge';
export type HouseModelConfidence = 'high' | 'low';

export type WorkbenchHouseSelection = {
  kind: 'house' | 'footprint' | 'roof' | 'deck' | 'opening' | 'attachment_zone';
  targetId: string | null;
};

export type HouseRoofModel = {
  id: string;
  form: HouseRoofForm;
  material: CalculatorHouseRoofMaterial;
  pitchDeg: string;
  primaryPitchDeg: string;
  primaryFallDirection: HouseRoofPrimaryFallDirection;
  ridgeAxis: HouseRoofRidgeAxis;
  openGableEndIds: string[];
  terminalEnds: Array<{
    id: string;
    label: string;
    sourceEdgeId: string;
    isOpen: boolean;
  }>;
  appendage: {
    enabled: boolean;
    form: HouseRoofAppendageForm;
    hostEdge: NonNullable<CalculatorModuleInputs['attachmentSide']>;
    pitchDeg: string;
    dropMm: string;
  };
  validation: {
    status: 'valid' | 'approximate' | 'invalid';
    code:
      | 'unsupported_roof_topology'
      | 'unsupported_gable_topology'
      | 'unsupported_hipped_topology'
      | 'invalid_appendage'
      | null;
    message: string | null;
    approximationReasons?: HouseRoofApproximationReason[];
  };
  provenance?: HouseRoofProvenance;
  capabilities: HouseRoofCapabilities & {
    footprintTopology: HouseRoofFootprintTopology;
    selectedFormFootprintRequirement: HouseRoofFootprintRequirement;
  };
  confidence: HouseModelConfidence;
  source: 'legacy_module_inference' | 'legacy_shared_value' | 'house_first_draft';
};

export type DeckModel = {
  id: string;
  name: string;
  kind: DeckKind;
  shape: DeckShape;
  presetType: DeckPresetType | null;
  presetRect: DeckPresetRect | null;
  // Floating preset decks use this local-space rectangle as their geometry source of truth.
  // `presetRect` remains the legacy edge-relative compatibility shape for PR2.
  floatingRect?: DeckFloatingPresetRect | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  elevationMode: DeckElevationMode;
  levelOffsetMm: string;
  // Floating preset decks may retain an optional witness edge for dimensions and future resnap hints.
  hostEdgeId: string | null;
  isAttached: boolean;
  surfaceMaterial: DeckSurfaceMaterial;
  topSurfaceElevationMm: number;
  supportContext: {
    classification: DeckSupportClassification;
    nearestHouseEdgeId: string | null;
    nearestHouseEdgeDistanceMm: number | null;
    attachmentContactLengthMm: number | null;
    warningCodes: DeckSupportWarningCode[];
    warningMessages: string[];
  };
  validation: {
    status: 'valid' | 'invalid';
    codes: DeckValidationCode[];
    messages: string[];
    message: string | null;
  };
};

export type WallOpeningModel = {
  id: string;
  label: string;
  kind: WallOpeningKind;
  panelCount: SliderPanelCount | null;
  wallId: WallOpeningHostSide | null;
  hostEdgeId: string | null;
  widthM: string;
  heightM: string;
  sillHeightM: string;
  offsetAlongWallM: string;
  validation: {
    status: 'valid' | 'invalid';
    codes: WallOpeningValidationCode[];
    message: string | null;
  };
};

export type HouseAttachmentZoneModel = {
  id: string;
  label: string;
  kind: HouseAttachmentZoneKind;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
};

export type HouseAttachmentZoneBlockReason =
  | 'invalid_roof_state'
  | 'missing_host_edge'
  | 'side_openings_block_wall'
  | 'side_openings_block_roof_zone'
  | 'unsupported_roof_form';

export type HouseAttachmentZoneDiagnosticsModel = {
  blocked: Array<{
    side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
    kind: HouseAttachmentZoneKind;
    reason: HouseAttachmentZoneBlockReason;
  }>;
};

export type HouseModel = {
  id: string;
  label: string;
  confidence: HouseModelConfidence;
  lowConfidence: boolean;
  sourceModuleIndexes: number[];
  sourceModuleIds: string[];
  footprint: {
    mode: CalculatorHouseFootprintMode;
    preset: CalculatorHouseFootprintPreset;
    params: CalculatorHouseFootprintParams;
    polygon: CalculatorHouseFootprintPolygonPoint[];
    drawingRotationQuarterTurns: CalculatorDrawingRotationQuarterTurns;
    attachmentSide: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  };
  roof: HouseRoofModel;
  storeyMode: CalculatorHouseStoreyMode;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  eaveHeightM: string;
  wallHeightM: string;
  soffitDepthMm: string;
  fasciaHeightMm: string;
  gutterWidthMm: string;
  gutterDepthMm: string;
  gutterProjectionMm: string;
  eaveOverhangMm: string;
  decks: DeckModel[];
  openings: WallOpeningModel[];
  attachmentZones: HouseAttachmentZoneModel[];
  attachmentZoneDiagnostics: HouseAttachmentZoneDiagnosticsModel;
};

export type PergolaAttachmentModel = {
  id: string;
  kind: 'freestanding' | 'soffit' | 'fascia' | 'wall';
  houseAttachmentZoneId: string | null;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  strategy: CalculatorHouseAttachmentStrategy | null;
};

export type PergolaModel = {
  id: string;
  label: string;
  family: 'mono' | 'gable' | 'box' | 'hip' | 'hip_corner' | 'unknown';
  confidence: HouseModelConfidence;
  sourceModuleIndexes: number[];
  sourceModuleIds: string[];
  attachment: PergolaAttachmentModel;
};

export type HouseFirstMigrationWarning = {
  id: string;
  code:
    | 'conflicting_house_field'
    | 'invalid_house_first_roof_overlay'
    | 'invalid_house_first_deck_overlay'
    | 'invalid_house_attachment_zone_overlay';
  severity: 'blocking';
  field: string;
  chosenModuleIndex: number;
  conflictingModuleIndexes: number[];
  message: string;
};

export type HouseFirstRoofDraft = {
  form?: HouseRoofForm | null;
  primaryPitchDeg?: string | null;
  material?: CalculatorHouseRoofMaterial | null;
  primaryFallDirection?: HouseRoofPrimaryFallDirection | null;
  ridgeAxis?: HouseRoofRidgeAxis | null;
  openGableEndIds?: string[] | null;
  appendage?: {
    enabled?: boolean | null;
    form?: HouseRoofAppendageForm | null;
    hostEdge?: NonNullable<CalculatorModuleInputs['attachmentSide']> | null;
    pitchDeg?: string | null;
    dropMm?: string | null;
  } | null;
};

export type HouseFirstDeckDraft = {
  id: string;
  name?: string | null;
  kind?: DeckKind | null;
  shape?: DeckShape | null;
  presetType?: DeckPresetType | null;
  presetRect?: DeckPresetRect | null;
  // Floating preset decks persist a local-space rectangle even while legacy edge-relative fields remain.
  floatingRect?: DeckFloatingPresetRect | null;
  outline?: CalculatorHouseFootprintPolygonPoint[] | null;
  elevationMode?: DeckElevationMode | null;
  levelOffsetMm?: string | null;
  hostEdgeId?: string | null;
  isAttached?: boolean | null;
  surfaceMaterial?: DeckSurfaceMaterial | null;
};

export type HouseFirstOpeningDraft = {
  id: string;
  label?: string | null;
  kind?: WallOpeningKind | null;
  panelCount?: SliderPanelCount | null;
  wallId?: WallOpeningHostSide | null;
  hostEdgeId?: string | null;
  widthM?: string | null;
  heightM?: string | null;
  sillHeightM?: string | null;
  offsetAlongWallM?: string | null;
};

export function isWallOpeningKind(value: unknown): value is WallOpeningKind {
  return typeof value === 'string' && WALL_OPENING_KINDS.includes(value as WallOpeningKind);
}

export function normalizeWallOpeningKind(value: unknown): WallOpeningKind {
  return isWallOpeningKind(value) ? value : 'window';
}

export function isSliderPanelCount(value: unknown): value is SliderPanelCount {
  return typeof value === 'number' && SLIDER_PANEL_COUNTS.includes(value as SliderPanelCount);
}

export function normalizeSliderPanelCount(value: unknown): SliderPanelCount | null {
  if (isSliderPanelCount(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return isSliderPanelCount(parsed) ? parsed : null;
  }
  return null;
}

export function resolveOpeningPanelCount(
  kind: WallOpeningKind,
  value: unknown,
): SliderPanelCount | null {
  if (kind !== 'slider') return null;
  return normalizeSliderPanelCount(value) ?? 2;
}

export type WorkbenchProjectModel = {
  source: 'legacy_estimate_snapshot';
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
};
