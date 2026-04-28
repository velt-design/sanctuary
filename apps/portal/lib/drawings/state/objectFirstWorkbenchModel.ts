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
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from './houseFirstWorkbenchModel';
import type {
  DeckElevationMode,
  DeckKind,
  DeckPresetType,
  DeckShape,
  DeckSurfaceMaterial,
  HouseAttachmentZoneKind,
  HouseRoofAppendageForm,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  SliderPanelCount,
  WallOpeningKind,
} from './houseFirstWorkbenchModel';

export type WorkbenchObjectFamily = 'house_forms' | 'decks' | 'openings' | 'pergolas';

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
  hostEdgeIds: string[];
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

export type DerivedRoofZoneModel = {
  id: string;
  label: string;
  sourceFormIds: string[];
  boundary: CalculatorHouseFootprintPolygonPoint[];
};

export type DerivedAttachmentZoneModel = {
  id: string;
  label: string;
  kind: HouseAttachmentZoneKind;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  sourceFormIds: string[];
  hostWallId: string | null;
  hostRoofZoneId: string | null;
};

export type DerivedBuildingEnvelopeModel = {
  mergedFormIds: string[];
  footprint: CalculatorHouseFootprintPolygonPoint[];
  wallGraph: DerivedWallGraphModel;
  roofZones: DerivedRoofZoneModel[];
  attachmentZones: DerivedAttachmentZoneModel[];
};

export type DeckObjectModel = {
  id: string;
  label: string;
  kind: DeckKind;
  shape: DeckShape;
  presetType: DeckPresetType | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  elevationMode: DeckElevationMode;
  levelOffsetMm: string;
  isAttached: boolean;
  surfaceMaterial: DeckSurfaceMaterial;
  hostEdgeId: string | null;
};

export type OpeningObjectModel = {
  id: string;
  label: string;
  kind: WallOpeningKind;
  panelCount: SliderPanelCount | null;
  hostWallId: string | null;
  sourceFormId?: string | null;
  widthM: string;
  heightM: string;
  sillHeightM: string;
  offsetAlongWallM: string;
};

export type PergolaObjectModel = {
  id: string;
  label: string;
  family: 'mono' | 'gable' | 'box' | 'hip' | 'hip_corner' | 'unknown';
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  strategy: CalculatorHouseAttachmentStrategy | null;
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

export type ObjectFirstHouseFormDraft = {
  id: string;
  label: string;
  transform: HouseFormTransformModel;
  footprint: HouseFormFootprintModel;
  roofIntent: HouseFormRoofIntentModel;
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
  outline: CalculatorHouseFootprintPolygonPoint[];
  elevationMode: DeckElevationMode;
  levelOffsetMm: string;
  isAttached: boolean;
  surfaceMaterial: DeckSurfaceMaterial;
  hostEdgeId: string | null;
};

export type ObjectFirstOpeningDraft = {
  id: string;
  label: string;
  kind: WallOpeningKind;
  panelCount: SliderPanelCount | null;
  hostWallId: string | null;
  sourceFormId?: string | null;
  widthM: string;
  heightM: string;
  sillHeightM: string;
  offsetAlongWallM: string;
};

export type ObjectFirstPergolaDraft = {
  id: string;
  label: string;
  family: 'mono' | 'gable' | 'box' | 'hip' | 'hip_corner' | 'unknown';
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  strategy: CalculatorHouseAttachmentStrategy | null;
};

export type ObjectFirstWorkbenchDraftVNext = {
  houseAssembly: ObjectFirstHouseAssemblyDraft | null;
  decks: ObjectFirstDeckDraft[];
  openings: ObjectFirstOpeningDraft[];
  pergolas: ObjectFirstPergolaDraft[];
};

// Migration boundary notes:
// - The current hidden workbench still runs from `houseFirstWorkbenchModel.ts`.
// - These object-first contracts are the canonical vNext type authority for future work.
// - This file does not imply dual-runtime support.
// - Persistence migration into `EstimateDrawingDraft` is intentionally deferred.
// - The authored draft helpers below define the future persistence shape only.
// - Current hidden workbench persistence remains `houseFirst` until a later migration slice.

function trimNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStableId(value: string | null | undefined): string | null {
  return trimNullableString(value);
}

function isHouseRoofForm(value: unknown): value is HouseRoofForm {
  return value === 'flat' || value === 'mono' || value === 'gable' || value === 'hipped';
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
    form: isHouseRoofForm(value?.form) ? value.form : 'gable',
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
    outline: normalizeHouseFootprintPolygon(value?.outline),
    elevationMode: isDeckElevationMode(value?.elevationMode) ? value.elevationMode : 'ground',
    levelOffsetMm: trimNullableString(value?.levelOffsetMm) ?? '0',
    isAttached: typeof value?.isAttached === 'boolean' ? value.isAttached : true,
    surfaceMaterial: isDeckSurfaceMaterial(value?.surfaceMaterial) ? value.surfaceMaterial : 'timber_decking',
    hostEdgeId: normalizeStableId(value?.hostEdgeId),
  };
}

export function normalizeObjectFirstOpeningDraft(
  value: Partial<ObjectFirstOpeningDraft> | null | undefined,
): ObjectFirstOpeningDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  const kind = normalizeWallOpeningKind(value?.kind);
  const panelCount = resolveOpeningPanelCount(kind, value?.panelCount);

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    kind,
    panelCount,
    hostWallId: normalizeStableId(value?.hostWallId),
    ...(normalizeStableId(value?.sourceFormId) ? { sourceFormId: normalizeStableId(value?.sourceFormId) } : null),
    widthM: trimNullableString(value?.widthM) ?? '0',
    heightM: trimNullableString(value?.heightM) ?? '0',
    sillHeightM: trimNullableString(value?.sillHeightM) ?? '0',
    offsetAlongWallM: trimNullableString(value?.offsetAlongWallM) ?? '0',
  };
}

export function normalizeObjectFirstPergolaDraft(
  value: Partial<ObjectFirstPergolaDraft> | null | undefined,
): ObjectFirstPergolaDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    family: isPergolaFamily(value?.family) ? value.family : 'unknown',
    attachmentEdgeId: normalizeStableId(value?.attachmentEdgeId),
    attachmentZoneId: normalizeStableId(value?.attachmentZoneId),
    side: normalizeAttachmentSide(value?.side),
    strategy: isCalculatorHouseAttachmentStrategy(value?.strategy) ? value.strategy : null,
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
