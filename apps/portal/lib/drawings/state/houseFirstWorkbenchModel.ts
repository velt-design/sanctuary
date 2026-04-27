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
export type DeckKind = 'deck' | 'landing';
export type DeckShape = 'preset' | 'custom';
export type DeckPresetType = 'rect_attached' | 'rect_detached';
export type DeckElevationMode = 'ground' | 'stepped' | 'aligned_to_threshold';
export type DeckSurfaceMaterial = 'timber_decking' | 'composite' | 'concrete';
export type DeckPresetRect = {
  widthM: string;
  depthM: string;
  centerOffsetM: string;
  detachedGapM?: string | null;
};
export type DeckSupportClassification = 'ground_supported' | 'threshold_attached' | 'mixed_or_unclear';
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
export type WallOpeningHostSide = NonNullable<CalculatorModuleInputs['attachmentSide']>;
export type WallOpeningValidationCode =
  | 'missing_host_wall'
  | 'invalid_width'
  | 'invalid_height'
  | 'invalid_sill_height'
  | 'offset_out_of_bounds'
  | 'span_exceeds_wall'
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
    status: 'valid' | 'invalid';
    code:
      | 'unsupported_roof_topology'
      | 'unsupported_gable_topology'
      | 'unsupported_hipped_topology'
      | 'invalid_appendage'
      | null;
    message: string | null;
  };
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
  outline: CalculatorHouseFootprintPolygonPoint[];
  elevationMode: DeckElevationMode;
  levelOffsetMm: string;
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
    | 'invalid_house_first_deck_overlay';
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

export type WorkbenchProjectModel = {
  source: 'legacy_estimate_snapshot';
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
};
