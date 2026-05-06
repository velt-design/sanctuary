import { isHouseRoofForm as isSupportedHouseRoofForm } from '@sp/geometry';
import {
  DEFAULT_CALCULATOR_HOUSE_ROOF_MATERIAL,
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPreset,
  type CalculatorDrawingRotationQuarterTurns,
  type CalculatorHouseAttachmentStrategy,
  type CalculatorHouseFootprintMode,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
  type CalculatorHouseFootprintPreset,
  type CalculatorHouseRoofMaterial,
  type CalculatorHouseStoreyMode,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';
export type WorkbenchObjectFamily = 'house_forms' | 'decks' | 'openings' | 'pergolas';

export type HouseRoofForm = 'flat' | 'mono' | 'gable' | 'hipped';
export type HouseRoofPrimaryFallDirection = 'positive_x' | 'negative_x' | 'positive_y' | 'negative_y';
export type HouseRoofRidgeAxis = 'x' | 'y';
export type HouseRoofAppendageForm = 'flat' | 'mono';
export type DeckKind = 'deck' | 'landing';
export type DeckShape = 'preset' | 'custom';
export type DeckAttachmentMode = 'floating' | 'single_edge' | 'corner_dual_edge';
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
  | 'ambiguous_host_wall'
  | 'invalid_width'
  | 'invalid_height'
  | 'invalid_sill_height'
  | 'offset_out_of_bounds'
  | 'span_exceeds_wall'
  | 'insufficient_corner_clearance'
  | 'overlapping_openings';
export type HouseAttachmentZoneKind = 'wall' | 'soffit' | 'fascia' | 'roof_edge';

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

export type WorkbenchObjectRef = {
  family: WorkbenchObjectFamily;
  objectId: string | null;
};

export type HouseFormTransformModel = {
  offsetXM: number;
  offsetYM: number;
  rotationQuarterTurns: CalculatorDrawingRotationQuarterTurns;
};

export type HouseFormFootprintModel = {
  mode: CalculatorHouseFootprintMode;
  preset: CalculatorHouseFootprintPreset;
  params: CalculatorHouseFootprintParams;
  polygon: CalculatorHouseFootprintPolygonPoint[];
  attachmentSide: NonNullable<CalculatorModuleInputs['attachmentSide']>;
};

export type HouseFormRoofIntentModel = {
  form: HouseRoofForm;
  material: CalculatorHouseRoofMaterial;
  primaryPitchDeg: string;
  primaryFallDirection: HouseRoofPrimaryFallDirection;
  ridgeAxis: HouseRoofRidgeAxis;
  openGableEndIds: string[];
  appendage: {
    enabled: boolean;
    form: HouseRoofAppendageForm;
    hostEdge: NonNullable<CalculatorModuleInputs['attachmentSide']>;
    pitchDeg: string;
    dropMm: string;
  };
};

export type HouseFormModel = {
  id: string;
  label: string;
  transform: HouseFormTransformModel;
  footprint: HouseFormFootprintModel;
  roofIntent: HouseFormRoofIntentModel;
  roofIntentAuthored?: boolean;
  storeyMode: CalculatorHouseStoreyMode;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  eaveHeightM?: string | null;
  wallHeightM?: string | null;
  soffitDepthMm?: string | null;
  fasciaHeightMm?: string | null;
  gutterWidthMm?: string | null;
  gutterDepthMm?: string | null;
  gutterProjectionMm?: string | null;
  eaveOverhangMm?: string | null;
  sourceModuleIndexes?: number[];
  sourceModuleIds?: string[];
};

export type DerivedWallModel = {
  id: string;
  label: string;
  sourceFormIds: string[];
  edgeIds: string[];
  kind: 'exterior';
  polygon: CalculatorHouseFootprintPolygonPoint[];
};

export type DerivedWallGraphModel = {
  walls: DerivedWallModel[];
  mergeGroups: Array<{
    id: string;
    sourceFormIds: string[];
    wallIds: string[];
  }>;
};

export type DerivedEnvelopeEdgeSemanticKind =
  | 'wall_perimeter'
  | 'roof_perimeter'
  | 'ridge'
  | 'valley'
  | 'eave'
  | 'gutter';

export type DerivedEnvelopeEdgeModel = {
  id: string;
  label: string;
  semanticKind: DerivedEnvelopeEdgeSemanticKind;
  sourceFormIds: string[];
  hostWallId: string | null;
  hostRoofZoneIds: string[];
  start: CalculatorHouseFootprintPolygonPoint;
  end: CalculatorHouseFootprintPolygonPoint;
};

export type DerivedRoofZoneModel = {
  id: string;
  label: string;
  sourceFormIds: string[];
  edgeIds: string[];
  boundary: CalculatorHouseFootprintPolygonPoint[];
};

export type DerivedAttachmentZoneModel = {
  id: string;
  label: string;
  kind: HouseAttachmentZoneKind;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  sourceFormIds: string[];
  hostWallId: string | null;
  hostEdgeId: string | null;
  hostRoofZoneId: string | null;
};

export type DerivedBuildingEnvelopeModel = {
  mergedFormIds: string[];
  footprint: CalculatorHouseFootprintPolygonPoint[];
  wallGraph: DerivedWallGraphModel;
  roofZones: DerivedRoofZoneModel[];
  edges: DerivedEnvelopeEdgeModel[];
  attachmentZones: DerivedAttachmentZoneModel[];
};

export type DeckObjectModel = {
  id: string;
  label: string;
  kind: DeckKind;
  shape: DeckShape;
  presetType: DeckPresetType | null;
  presetRect?: DeckPresetRect | null;
  floatingRect?: DeckFloatingPresetRect | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  elevationMode: DeckElevationMode;
  levelOffsetMm: string;
  isAttached: boolean;
  surfaceMaterial: DeckSurfaceMaterial;
  hostEdgeId: string | null;
  attachmentMode?: DeckAttachmentMode | null;
  primaryHostEdgeId?: string | null;
  secondaryHostEdgeId?: string | null;
  cornerVertexId?: string | null;
  topSurfaceElevationMm?: number | null;
  supportContext?: {
    classification: DeckSupportClassification;
    nearestHouseEdgeId: string | null;
    nearestHouseEdgeDistanceMm: number | null;
    attachmentContactLengthMm: number | null;
    attachmentContacts?: Array<{
      hostEdgeId: string;
      lengthMm: number;
    }>;
    warningCodes: DeckSupportWarningCode[];
    warningMessages: string[];
  } | null;
  validation?: {
    status: 'valid' | 'invalid';
    codes: DeckValidationCode[];
    messages: string[];
    message: string | null;
  } | null;
};

export type OpeningObjectModel = {
  id: string;
  label: string;
  kind: WallOpeningKind;
  panelCount: SliderPanelCount | null;
  hostWallId: string | null;
  sourceFormId?: string | null;
  wallId?: WallOpeningHostSide | null;
  hostEdgeId?: string | null;
  widthM: string;
  heightM: string;
  sillHeightM: string;
  offsetAlongWallM: string;
  validation?: {
    status: 'valid' | 'invalid';
    codes: WallOpeningValidationCode[];
    message: string | null;
  } | null;
};

/**
 * Per-object world position for a pergola. When set, geometry treats the pergola
 * as free-floating: the datum origin + axes come from this field instead of
 * being derived from `connection.type` + the house attachment edge.
 *
 * Phase 2 of the free-floating-objects migration. Stored as strings to match
 * the rest of the persisted draft shape (the normalizer parses to numbers).
 *
 * See docs/design-workbench-architecture.md.
 */
export type ObjectFirstPergolaPosition = {
  originXMm: string;
  originYMm: string;
  rotationDeg: string;
};

export type PergolaObjectModel = {
  id: string;
  label: string;
  family: 'mono' | 'gable' | 'box' | 'hip' | 'hip_corner' | 'unknown';
  connectionKind?: ObjectFirstPergolaConnectionKind | null;
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  strategy: CalculatorHouseAttachmentStrategy | null;
  geometry?: ObjectFirstPergolaGeometryDraft | null;
  position?: ObjectFirstPergolaPosition | null;
};

export type HouseAssemblyModel = {
  id: string;
  label: string;
  houseForms: HouseFormModel[];
  derivedEnvelope: DerivedBuildingEnvelopeModel | null;
};

export type ObjectFirstWorkbenchProjectModel = {
  source: 'legacy_estimate_snapshot';
  houseAssembly: HouseAssemblyModel | null;
  decks: DeckObjectModel[];
  openings: OpeningObjectModel[];
  pergolas: PergolaObjectModel[];
  warnings: string[];
};

// Canonical object-first vocabulary used by the active April workbench docs.
// The existing `*Model` / `ObjectFirst*` exports remain as temporary compatibility aliases for this slice.
export type HouseForm = HouseFormModel;
export type DerivedBuildingEnvelope = DerivedBuildingEnvelopeModel;
export type Deck = DeckObjectModel;
export type Opening = OpeningObjectModel;
export type Pergola = PergolaObjectModel;
export type HouseAssembly = HouseAssemblyModel;
export type WorkbenchProjectModel = ObjectFirstWorkbenchProjectModel;

export type ObjectFirstHouseFormDraft = {
  id: string;
  label: string;
  transform: HouseFormTransformModel;
  footprint: HouseFormFootprintModel;
  roofIntent: HouseFormRoofIntentModel;
  roofIntentAuthored?: boolean;
  storeyMode: CalculatorHouseStoreyMode;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  eaveHeightM?: string | null;
  wallHeightM?: string | null;
  soffitDepthMm?: string | null;
  fasciaHeightMm?: string | null;
  gutterWidthMm?: string | null;
  gutterDepthMm?: string | null;
  gutterProjectionMm?: string | null;
  eaveOverhangMm?: string | null;
};

export type ObjectFirstHouseAssemblyDraft = {
  id: string;
  label: string;
  houseForms: ObjectFirstHouseFormDraft[];
};

export type ObjectFirstDeckDraft = {
  id: string;
  label: string;
  kind: DeckKind;
  shape: DeckShape;
  presetType: DeckPresetType | null;
  presetRect?: DeckPresetRect | null;
  floatingRect?: DeckFloatingPresetRect | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  elevationMode: DeckElevationMode;
  levelOffsetMm: string;
  isAttached: boolean;
  surfaceMaterial: DeckSurfaceMaterial;
  hostEdgeId: string | null;
  attachmentMode?: DeckAttachmentMode | null;
  primaryHostEdgeId?: string | null;
  secondaryHostEdgeId?: string | null;
  cornerVertexId?: string | null;
};

export type ObjectFirstOpeningDraft = {
  id: string;
  label: string;
  kind: WallOpeningKind;
  panelCount: SliderPanelCount | null;
  hostWallId: string | null;
  sourceFormId?: string | null;
  wallId?: WallOpeningHostSide | null;
  hostEdgeId?: string | null;
  widthM: string;
  heightM: string;
  sillHeightM: string;
  offsetAlongWallM: string;
};

export type ObjectFirstPergolaDraft = {
  id: string;
  label: string;
  family: 'mono' | 'gable' | 'box' | 'hip' | 'hip_corner' | 'unknown';
  connectionKind?: ObjectFirstPergolaConnectionKind | null;
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  strategy: CalculatorHouseAttachmentStrategy | null;
  geometry?: ObjectFirstPergolaGeometryDraft | null;
  position?: ObjectFirstPergolaPosition | null;
};

export type ObjectFirstPergolaConnectionKind = 'freestanding' | 'soffit' | 'fascia' | 'wall';

export type ObjectFirstPergolaGeometryDraft = {
  dimensions?: Partial<Record<
    'lengthM' | 'projectionM' | 'hipCornerLengthBM' | 'hipCornerProjectionBM',
    string
  >>;
  roof?: Partial<{
    material: CalculatorModuleInputs['roofMaterial'];
    pitchDeg: string;
    boxPerimeterEnabled: boolean;
    mixedAcrylicBaysMain: string;
    mixedAcrylicBaysA: string;
    mixedAcrylicBaysB: string;
  }>;
  gable?: Partial<{
    endFramesMode: CalculatorModuleInputs['gableEndFramesMode'];
    houseEaveGutterMode: CalculatorModuleInputs['gableHouseEdgeGutter'];
    outerEaveGutterMode: CalculatorModuleInputs['gableOuterEdgeGutter'];
  }>;
  supports?: Partial<{
    postConnectionType: CalculatorModuleInputs['postConnectionType'];
    ground: CalculatorModuleInputs['ground'];
    postCount: string;
    postCutHeightM: string;
  }>;
  overrides?: Partial<Pick<
    NonNullable<CalculatorModuleInputs['overrides']>,
    | 'ledgerProfile'
    | 'rafterProfile'
    | 'postProfile'
    | 'frontBeamProfile'
    | 'ridgeBeamProfile'
    | 'boxPerimeterBeamProfile'
    | 'tieBeamProfile'
    | 'strutProfile'
  >>;
};

export type ObjectFirstWorkbenchDraftVNext = {
  houseAssembly: ObjectFirstHouseAssemblyDraft | null;
  decks: ObjectFirstDeckDraft[];
  openings: ObjectFirstOpeningDraft[];
  pergolas: ObjectFirstPergolaDraft[];
};

// Migration boundary notes:
// - This file is the canonical object-first type authority for the active April workbench docs.
// - Hidden workbench local drafts now write `EstimateDrawingDraft.objectFirst`.
// - Compatibility projections still feed geometry, overlays, and calculators that consume house-first models.
// - `roofIntentAuthored` keeps snapshot-inferred roofs from becoming explicit compatibility roof overrides.

function trimNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStableId(value: string | null | undefined): string | null {
  return trimNullableString(value);
}

function isHouseRoofPrimaryFallDirection(value: unknown): value is HouseRoofPrimaryFallDirection {
  return value === 'positive_x' || value === 'negative_x' || value === 'positive_y' || value === 'negative_y';
}

function isHouseRoofRidgeAxis(value: unknown): value is HouseRoofRidgeAxis {
  return value === 'x' || value === 'y';
}

function isHouseRoofAppendageForm(value: unknown): value is HouseRoofAppendageForm {
  return value === 'flat' || value === 'mono';
}

function isCalculatorHouseStoreyMode(value: unknown): value is CalculatorHouseStoreyMode {
  return value === 'single_storey' || value === 'double_storey' || value === 'custom';
}

function isCalculatorHouseAttachmentStrategy(value: unknown): value is CalculatorHouseAttachmentStrategy {
  return (
    value === 'soffit_brackets' ||
    value === 'fascia_under_gutter' ||
    value === 'facade_ledger' ||
    value === 'post_supported_tieback' ||
    value === 'none'
  );
}

function isCalculatorHouseRoofMaterial(value: unknown): value is CalculatorHouseRoofMaterial {
  return (
    value === 'corrugated_iron' ||
    value === 'trapezoidal_5_rib' ||
    value === 'eurotray_300' ||
    value === 'eurotray_500' ||
    value === 'shingles'
  );
}

function isDeckKind(value: unknown): value is DeckKind {
  return value === 'deck' || value === 'landing';
}

function isDeckShape(value: unknown): value is DeckShape {
  return value === 'preset' || value === 'custom';
}

function isDeckPresetType(value: unknown): value is DeckPresetType {
  return value === 'rect_attached' || value === 'rect_detached';
}

function isDeckElevationMode(value: unknown): value is DeckElevationMode {
  return value === 'ground' || value === 'stepped' || value === 'aligned_to_threshold';
}

function isDeckAttachmentMode(value: unknown): value is DeckAttachmentMode {
  return value === 'floating' || value === 'single_edge' || value === 'corner_dual_edge';
}

function isDeckSurfaceMaterial(value: unknown): value is DeckSurfaceMaterial {
  return value === 'timber_decking' || value === 'composite' || value === 'concrete';
}

function isPergolaFamily(value: unknown): value is ObjectFirstPergolaDraft['family'] {
  return (
    value === 'mono' ||
    value === 'gable' ||
    value === 'box' ||
    value === 'hip' ||
    value === 'hip_corner' ||
    value === 'unknown'
  );
}

function isObjectFirstPergolaConnectionKind(value: unknown): value is ObjectFirstPergolaConnectionKind {
  return value === 'freestanding' || value === 'soffit' || value === 'fascia' || value === 'wall';
}

function isPortalRoofMaterial(value: unknown): value is CalculatorModuleInputs['roofMaterial'] {
  return value === 'acrylic' || value === 'timber' || value === 'mixed' || value === 'insulated' || value === 'louvre';
}

function isGableEndFramesMode(value: unknown): value is CalculatorModuleInputs['gableEndFramesMode'] {
  return value === 'none' || value === 'outer_end_only' || value === 'both_ends';
}

function isHouseEdgeGutterMode(value: unknown): value is CalculatorModuleInputs['gableHouseEdgeGutter'] {
  return value === 'house' || value === 'our';
}

function isPostConnectionType(value: unknown): value is CalculatorModuleInputs['postConnectionType'] {
  return value === 'pile_1m' || value === 'pile_1_5m' || value === 'deck_bracket' || value === 'slab_anchors';
}

function isGroundCondition(value: unknown): value is CalculatorModuleInputs['ground'] {
  return value === 'easy' || value === 'hard';
}

function isWallOpeningHostSide(value: unknown): value is WallOpeningHostSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function normalizeHouseFormTransform(
  value: Partial<HouseFormTransformModel> | null | undefined,
): HouseFormTransformModel {
  return {
    offsetXM: typeof value?.offsetXM === 'number' && Number.isFinite(value.offsetXM) ? value.offsetXM : 0,
    offsetYM: typeof value?.offsetYM === 'number' && Number.isFinite(value.offsetYM) ? value.offsetYM : 0,
    rotationQuarterTurns: normalizeDrawingRotationQuarterTurns(value?.rotationQuarterTurns),
  };
}

function normalizeHouseFormFootprint(
  value: Partial<HouseFormFootprintModel> | null | undefined,
): HouseFormFootprintModel {
  return {
    mode: normalizeHouseFootprintMode(value?.mode),
    preset: normalizeHouseFootprintPreset(value?.preset),
    params: normalizeHouseFootprintParams(value?.params),
    polygon: normalizeHouseFootprintPolygon(value?.polygon),
    attachmentSide: normalizeAttachmentSide(value?.attachmentSide),
  };
}

function normalizeHouseFormRoofIntent(
  value: Partial<HouseFormRoofIntentModel> | null | undefined,
): HouseFormRoofIntentModel {
  const openGableEndIds = Array.isArray(value?.openGableEndIds)
    ? [...new Set(
      value.openGableEndIds
        .filter((candidate): candidate is string => typeof candidate === 'string')
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0),
    )]
    : [];

  return {
    form: isSupportedHouseRoofForm(value?.form) ? value.form : 'gable',
    material: isCalculatorHouseRoofMaterial(value?.material) ? value.material : DEFAULT_CALCULATOR_HOUSE_ROOF_MATERIAL,
    primaryPitchDeg: trimNullableString(value?.primaryPitchDeg) ?? '5',
    primaryFallDirection: isHouseRoofPrimaryFallDirection(value?.primaryFallDirection)
      ? value.primaryFallDirection
      : 'negative_y',
    ridgeAxis: isHouseRoofRidgeAxis(value?.ridgeAxis) ? value.ridgeAxis : 'x',
    openGableEndIds,
    appendage: {
      enabled: typeof value?.appendage?.enabled === 'boolean' ? value.appendage.enabled : false,
      form: isHouseRoofAppendageForm(value?.appendage?.form) ? value.appendage.form : 'flat',
      hostEdge: normalizeAttachmentSide(value?.appendage?.hostEdge),
      pitchDeg: trimNullableString(value?.appendage?.pitchDeg) ?? '0',
      dropMm: trimNullableString(value?.appendage?.dropMm) ?? '0',
    },
  };
}

function normalizeObjectFirstDeckPresetRect(
  value: Partial<DeckPresetRect> | null | undefined,
): DeckPresetRect | null {
  if (!value) return null;
  const widthM = trimNullableString(value.widthM);
  const depthM = trimNullableString(value.depthM);
  const centerOffsetM = trimNullableString(value.centerOffsetM);
  if (!widthM && !depthM && !centerOffsetM) return null;
  return {
    widthM: widthM ?? '0',
    depthM: depthM ?? '0',
    centerOffsetM: centerOffsetM ?? '0',
    ...(trimNullableString(value.detachedGapM) ? { detachedGapM: trimNullableString(value.detachedGapM) } : null),
  };
}

function normalizeObjectFirstDeckFloatingRect(
  value: Partial<DeckFloatingPresetRect> | null | undefined,
): DeckFloatingPresetRect | null {
  if (!value) return null;
  const centerAlongM = trimNullableString(value.centerAlongM);
  const centerDepthM = trimNullableString(value.centerDepthM);
  const widthM = trimNullableString(value.widthM);
  const depthM = trimNullableString(value.depthM);
  if (!centerAlongM && !centerDepthM && !widthM && !depthM) return null;
  return {
    centerAlongM: centerAlongM ?? '0',
    centerDepthM: centerDepthM ?? '0',
    widthM: widthM ?? '0',
    depthM: depthM ?? '0',
  };
}

export function normalizeObjectFirstHouseFormDraft(
  value: Partial<ObjectFirstHouseFormDraft> | null | undefined,
): ObjectFirstHouseFormDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    transform: normalizeHouseFormTransform(value?.transform),
    footprint: normalizeHouseFormFootprint(value?.footprint),
    roofIntent: normalizeHouseFormRoofIntent(value?.roofIntent),
    ...(value?.roofIntentAuthored === true ? { roofIntentAuthored: true } : null),
    storeyMode: isCalculatorHouseStoreyMode(value?.storeyMode) ? value.storeyMode : 'single_storey',
    attachmentStrategy: isCalculatorHouseAttachmentStrategy(value?.attachmentStrategy)
      ? value.attachmentStrategy
      : null,
    ...(trimNullableString(value?.eaveHeightM) ? { eaveHeightM: trimNullableString(value?.eaveHeightM) } : null),
    ...(trimNullableString(value?.wallHeightM) ? { wallHeightM: trimNullableString(value?.wallHeightM) } : null),
    ...(trimNullableString(value?.soffitDepthMm) ? { soffitDepthMm: trimNullableString(value?.soffitDepthMm) } : null),
    ...(trimNullableString(value?.fasciaHeightMm) ? { fasciaHeightMm: trimNullableString(value?.fasciaHeightMm) } : null),
    ...(trimNullableString(value?.gutterWidthMm) ? { gutterWidthMm: trimNullableString(value?.gutterWidthMm) } : null),
    ...(trimNullableString(value?.gutterDepthMm) ? { gutterDepthMm: trimNullableString(value?.gutterDepthMm) } : null),
    ...(trimNullableString(value?.gutterProjectionMm)
      ? { gutterProjectionMm: trimNullableString(value?.gutterProjectionMm) }
      : null),
    ...(trimNullableString(value?.eaveOverhangMm)
      ? { eaveOverhangMm: trimNullableString(value?.eaveOverhangMm) }
      : null),
  };
}

export function normalizeObjectFirstHouseAssemblyDraft(
  value: Partial<ObjectFirstHouseAssemblyDraft> | null | undefined,
): ObjectFirstHouseAssemblyDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  const houseForms = (value?.houseForms ?? [])
    .map((houseForm) => normalizeObjectFirstHouseFormDraft(houseForm))
    .filter((houseForm): houseForm is ObjectFirstHouseFormDraft => Boolean(houseForm));

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    houseForms,
  };
}

export function normalizeObjectFirstDeckDraft(
  value: Partial<ObjectFirstDeckDraft> | null | undefined,
): ObjectFirstDeckDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    kind: isDeckKind(value?.kind) ? value.kind : 'deck',
    shape: isDeckShape(value?.shape) ? value.shape : 'preset',
    presetType: isDeckPresetType(value?.presetType) ? value.presetType : null,
    ...(normalizeObjectFirstDeckPresetRect(value?.presetRect)
      ? { presetRect: normalizeObjectFirstDeckPresetRect(value?.presetRect) }
      : null),
    ...(normalizeObjectFirstDeckFloatingRect(value?.floatingRect)
      ? { floatingRect: normalizeObjectFirstDeckFloatingRect(value?.floatingRect) }
      : null),
    outline: normalizeHouseFootprintPolygon(value?.outline),
    elevationMode: isDeckElevationMode(value?.elevationMode) ? value.elevationMode : 'ground',
    levelOffsetMm: trimNullableString(value?.levelOffsetMm) ?? '0',
    isAttached: typeof value?.isAttached === 'boolean' ? value.isAttached : true,
    surfaceMaterial: isDeckSurfaceMaterial(value?.surfaceMaterial) ? value.surfaceMaterial : 'timber_decking',
    hostEdgeId: normalizeStableId(value?.hostEdgeId),
    ...(isDeckAttachmentMode(value?.attachmentMode) ? { attachmentMode: value.attachmentMode } : null),
    ...(normalizeStableId(value?.primaryHostEdgeId) ? { primaryHostEdgeId: normalizeStableId(value?.primaryHostEdgeId) } : null),
    ...(normalizeStableId(value?.secondaryHostEdgeId)
      ? { secondaryHostEdgeId: normalizeStableId(value?.secondaryHostEdgeId) }
      : null),
    ...(normalizeStableId(value?.cornerVertexId) ? { cornerVertexId: normalizeStableId(value?.cornerVertexId) } : null),
  };
}

export function normalizeObjectFirstOpeningDraft(
  value: Partial<ObjectFirstOpeningDraft> | null | undefined,
): ObjectFirstOpeningDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  const kind = normalizeWallOpeningKind(value?.kind);
  const panelCount = resolveOpeningPanelCount(kind, value?.panelCount);
  const sourceFormId = normalizeStableId(value?.sourceFormId);
  const wallId = value?.wallId;
  const hostEdgeId = normalizeStableId(value?.hostEdgeId);

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    kind,
    panelCount,
    hostWallId: normalizeStableId(value?.hostWallId),
    ...(sourceFormId ? { sourceFormId } : null),
    ...(isWallOpeningHostSide(wallId) ? { wallId } : null),
    ...(hostEdgeId ? { hostEdgeId } : null),
    widthM: trimNullableString(value?.widthM) ?? '0',
    heightM: trimNullableString(value?.heightM) ?? '0',
    sillHeightM: trimNullableString(value?.sillHeightM) ?? '0',
    offsetAlongWallM: trimNullableString(value?.offsetAlongWallM) ?? '0',
  };
}

function normalizePergolaGeometryStringFields<T extends string>(
  source: Partial<Record<T, string | null | undefined>> | null | undefined,
  keys: T[],
): Partial<Record<T, string>> | undefined {
  const result: Partial<Record<T, string>> = {};
  for (const key of keys) {
    const value = trimNullableString(source?.[key]);
    if (value !== null) {
      result[key] = value;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function normalizeObjectFirstPergolaGeometryDraft(
  value: Partial<ObjectFirstPergolaGeometryDraft> | null | undefined,
): ObjectFirstPergolaGeometryDraft | null {
  if (!value) return null;

  const dimensions = normalizePergolaGeometryStringFields(value.dimensions, [
    'lengthM',
    'projectionM',
    'hipCornerLengthBM',
    'hipCornerProjectionBM',
  ]);
  const roofStringFields = normalizePergolaGeometryStringFields(value.roof, [
    'pitchDeg',
    'mixedAcrylicBaysMain',
    'mixedAcrylicBaysA',
    'mixedAcrylicBaysB',
  ]);
  const roof: ObjectFirstPergolaGeometryDraft['roof'] = {
    ...(roofStringFields ?? {}),
    ...(isPortalRoofMaterial(value.roof?.material) ? { material: value.roof.material } : null),
    ...(typeof value.roof?.boxPerimeterEnabled === 'boolean'
      ? { boxPerimeterEnabled: value.roof.boxPerimeterEnabled }
      : null),
  };
  const gable: ObjectFirstPergolaGeometryDraft['gable'] = {
    ...(isGableEndFramesMode(value.gable?.endFramesMode)
      ? { endFramesMode: value.gable.endFramesMode }
      : null),
    ...(isHouseEdgeGutterMode(value.gable?.houseEaveGutterMode)
      ? { houseEaveGutterMode: value.gable.houseEaveGutterMode }
      : null),
    ...(isHouseEdgeGutterMode(value.gable?.outerEaveGutterMode)
      ? { outerEaveGutterMode: value.gable.outerEaveGutterMode }
      : null),
  };
  const supportStringFields = normalizePergolaGeometryStringFields(value.supports, [
    'postCount',
    'postCutHeightM',
  ]);
  const supports: ObjectFirstPergolaGeometryDraft['supports'] = {
    ...(supportStringFields ?? {}),
    ...(isPostConnectionType(value.supports?.postConnectionType)
      ? { postConnectionType: value.supports.postConnectionType }
      : null),
    ...(isGroundCondition(value.supports?.ground) ? { ground: value.supports.ground } : null),
  };
  const overrides = normalizePergolaGeometryStringFields(value.overrides, [
    'ledgerProfile',
    'rafterProfile',
    'postProfile',
    'frontBeamProfile',
    'ridgeBeamProfile',
    'boxPerimeterBeamProfile',
    'tieBeamProfile',
    'strutProfile',
  ]);

  const result: ObjectFirstPergolaGeometryDraft = {
    ...(dimensions ? { dimensions } : null),
    ...(roof && Object.keys(roof).length ? { roof } : null),
    ...(gable && Object.keys(gable).length ? { gable } : null),
    ...(supports && Object.keys(supports).length ? { supports } : null),
    ...(overrides ? { overrides } : null),
  };
  return Object.keys(result).length ? result : null;
}

function normalizeObjectFirstPergolaPosition(
  value: Partial<ObjectFirstPergolaPosition> | null | undefined,
): ObjectFirstPergolaPosition | null {
  if (!value) return null;
  const originXMm = trimNullableString(value.originXMm);
  const originYMm = trimNullableString(value.originYMm);
  if (originXMm === null || originYMm === null) return null;
  return {
    originXMm,
    originYMm,
    rotationDeg: trimNullableString(value.rotationDeg) ?? '0',
  };
}

export function normalizeObjectFirstPergolaDraft(
  value: Partial<ObjectFirstPergolaDraft> | null | undefined,
): ObjectFirstPergolaDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;
  const geometry = normalizeObjectFirstPergolaGeometryDraft(value?.geometry);
  const position = normalizeObjectFirstPergolaPosition(value?.position ?? null);

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    family: isPergolaFamily(value?.family) ? value.family : 'unknown',
    ...(isObjectFirstPergolaConnectionKind(value?.connectionKind)
      ? { connectionKind: value.connectionKind }
      : null),
    attachmentEdgeId: normalizeStableId(value?.attachmentEdgeId),
    attachmentZoneId: normalizeStableId(value?.attachmentZoneId),
    side: normalizeAttachmentSide(value?.side),
    strategy: isCalculatorHouseAttachmentStrategy(value?.strategy) ? value.strategy : null,
    ...(geometry ? { geometry } : null),
    ...(position ? { position } : null),
  };
}

export function normalizeObjectFirstWorkbenchDraftVNext(
  value: Partial<ObjectFirstWorkbenchDraftVNext> | null | undefined,
): ObjectFirstWorkbenchDraftVNext {
  return {
    houseAssembly: normalizeObjectFirstHouseAssemblyDraft(value?.houseAssembly),
    decks: (value?.decks ?? [])
      .map((deck) => normalizeObjectFirstDeckDraft(deck))
      .filter((deck): deck is ObjectFirstDeckDraft => Boolean(deck)),
    openings: (value?.openings ?? [])
      .map((opening) => normalizeObjectFirstOpeningDraft(opening))
      .filter((opening): opening is ObjectFirstOpeningDraft => Boolean(opening)),
    pergolas: (value?.pergolas ?? [])
      .map((pergola) => normalizeObjectFirstPergolaDraft(pergola))
      .filter((pergola): pergola is ObjectFirstPergolaDraft => Boolean(pergola)),
  };
}
