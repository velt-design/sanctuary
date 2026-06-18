import {
  deriveHouseGableTerminalEnds,
  isHouseRoofForm as isSupportedHouseRoofForm,
  validateHouseComposition,
  type HouseComposition,
} from "@sp/geometry";
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
} from "@/lib/types/calculator";
export type WorkbenchObjectFamily =
  | "house_forms"
  | "decks"
  | "openings"
  | "pergolas";

export type WorkbenchAttachmentSide = "rear" | "front" | "left" | "right";
export type WorkbenchPergolaRoofMaterial =
  | "acrylic"
  | "timber"
  | "mixed"
  | "insulated"
  | "louvre";
export type WorkbenchPergolaGableEndFramesMode =
  | "none"
  | "outer_end_only"
  | "both_ends";
export type WorkbenchPergolaHouseEdgeGutterMode = "house" | "our";
export type WorkbenchPergolaPostConnectionType =
  | "pile_1m"
  | "pile_1_5m"
  | "deck_bracket"
  | "slab_anchors";
export type WorkbenchPergolaGroundCondition = "easy" | "hard";
export type WorkbenchPergolaOverrideProfiles = {
  ledgerProfile?: string | null;
  rafterProfile?: string | null;
  postProfile?: string | null;
  frontBeamProfile?: string | null;
  ridgeBeamProfile?: string | null;
  boxPerimeterBeamProfile?: string | null;
  tieBeamProfile?: string | null;
  strutProfile?: string | null;
};

export type HouseRoofForm = "flat" | "mono" | "hipped";
export type HouseRoofPrimaryFallDirection =
  | "positive_x"
  | "negative_x"
  | "positive_y"
  | "negative_y";
export type HouseRoofRidgeAxis = "x" | "y";
// PR-T8 (2026-05-29): `HouseRoofAppendageForm` removed with the
// appendage feature cull.
// PR-T9 (2026-05-29): `DeckKind` and `DeckElevationMode` removed with the
// deck inspector cull. `kind` was passed to costing but never branched on;
// `elevationMode` only branched on `'ground'` vs not-ground to clamp
// negative offsets, which the user never observed firing.
export type DeckShape = "preset" | "custom";
export type DeckAttachmentMode =
  | "floating"
  | "single_edge"
  | "corner_dual_edge";
export type DeckPresetType = "rect_attached" | "rect_detached";
export type DeckSurfaceMaterial = "timber_decking" | "composite" | "concrete";
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
export type DeckSupportClassification =
  | "ground_supported"
  | "threshold_attached"
  | "mixed_or_unclear";
export type DeckSupportWarningCode =
  | "insufficient_host_edge_contact"
  | "detached_too_close_to_house"
  | "threshold_alignment_offset"
  | "unsupported_house_intersection";
export type DeckValidationCode =
  | "self_intersecting_outline"
  | "outline_inside_house"
  | "attached_missing_host_edge"
  | "overlapping_decks"
  | "detached_threshold_alignment"
  | "unsupported_house_intersection";
export type WallOpeningKind = "window" | "hinged_door" | "slider" | "stacker";
export const WALL_OPENING_KINDS = [
  "window",
  "hinged_door",
  "slider",
  "stacker",
] as const;
export type SliderPanelCount = 2 | 3 | 4;
export const SLIDER_PANEL_COUNTS = [2, 3, 4] as const;
export type WallOpeningHostSide = NonNullable<
  WorkbenchAttachmentSide
>;
export type WallOpeningValidationCode =
  | "missing_host_wall"
  | "ambiguous_host_wall"
  | "invalid_width"
  | "invalid_height"
  | "invalid_sill_height"
  | "offset_out_of_bounds"
  | "span_exceeds_wall"
  | "insufficient_corner_clearance"
  | "overlapping_openings";
export type HouseAttachmentZoneKind =
  | "wall"
  | "soffit"
  | "fascia"
  | "roof_edge";

export function isWallOpeningKind(value: unknown): value is WallOpeningKind {
  return (
    typeof value === "string" &&
    WALL_OPENING_KINDS.includes(value as WallOpeningKind)
  );
}

export function normalizeWallOpeningKind(value: unknown): WallOpeningKind {
  return isWallOpeningKind(value) ? value : "window";
}

export function isSliderPanelCount(value: unknown): value is SliderPanelCount {
  return (
    typeof value === "number" &&
    SLIDER_PANEL_COUNTS.includes(value as SliderPanelCount)
  );
}

export function normalizeSliderPanelCount(
  value: unknown,
): SliderPanelCount | null {
  if (isSliderPanelCount(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return isSliderPanelCount(parsed) ? parsed : null;
  }
  return null;
}

export function resolveOpeningPanelCount(
  kind: WallOpeningKind,
  value: unknown,
): SliderPanelCount | null {
  if (kind !== "slider") return null;
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

/**
 * World-space position of a house form. Origin is in mm, rotation in degrees
 * around +Z. Mirrors `ObjectFirstPergolaPosition` for parity — the "every
 * object is a first-class spatial entity" architecture means each object
 * stores its own world transform, decoupled from any other object's frame.
 *
 * `position` is optional because older object-first drafts may not have
 * persisted it yet. When absent, normalizers seed a stable object transform;
 * geometry solving should consume the house form's own object frame.
 */
export type HouseFormPosition = {
  originXMm: string;
  originYMm: string;
  rotationDeg: string;
};

export type HouseFormFootprintModel = {
  mode: CalculatorHouseFootprintMode;
  preset: CalculatorHouseFootprintPreset;
  params: CalculatorHouseFootprintParams;
  polygon: CalculatorHouseFootprintPolygonPoint[];
  attachmentSide: WorkbenchAttachmentSide;
  /** Optional world-space position. See `HouseFormPosition` for details. */
  position?: HouseFormPosition | null;
};

export type HouseFormRoofIntentModel = {
  form: HouseRoofForm;
  material: CalculatorHouseRoofMaterial;
  primaryPitchDeg: string;
  primaryFallDirection: HouseRoofPrimaryFallDirection;
  ridgeAxis: HouseRoofRidgeAxis;
  openGableEndIds: string[];
  // PR-T8 (2026-05-29): `appendage` field removed.
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
  /**
   * PR-COMP-PHASE2 (2026-06-18): authored composition for new
   * house forms produced by the Phase 3 rectangle tool. When
   * present, downstream consumers SHOULD prefer composition data
   * over `footprint.polygon` — composition carries explicit join
   * topology and per-rectangle roof intent that the legacy
   * polygon doesn't.
   *
   * Optional; absent on every legacy free-form house form. The
   * legacy `footprint` polygon remains the source of truth when
   * `composition` is absent. Phase 3 wires composition into the
   * roof solver; Phase 2 only adds the data field + persistence.
   */
  composition?: HouseComposition | null;
};

export type HouseRoofIntentResolutionSource =
  | "object_first_authored"
  | "object_first_unauthed_default"
  | "object_first_unauthed_mono_repair";

export type HouseRoofIntentAuthorshipResolution = {
  roofIntent: HouseFormRoofIntentModel;
  roofIntentAuthored: boolean;
  rawForm: HouseRoofForm;
  resolvedForm: HouseRoofForm;
  source: HouseRoofIntentResolutionSource;
  repairCode: "unauthed_mono_repaired_to_hipped" | null;
};

export function resolveHouseRoofIntentForAuthorship(input: {
  roofIntent: HouseFormRoofIntentModel;
  roofIntentAuthored?: boolean | null;
}): HouseRoofIntentAuthorshipResolution {
  const roofIntentAuthored = input.roofIntentAuthored === true;
  const rawForm = input.roofIntent.form;
  if (!roofIntentAuthored && rawForm === "mono") {
    const roofIntent: HouseFormRoofIntentModel = {
      ...input.roofIntent,
      form: "hipped",
      openGableEndIds: [],
    };
    return {
      roofIntent,
      roofIntentAuthored,
      rawForm,
      resolvedForm: roofIntent.form,
      source: "object_first_unauthed_mono_repair",
      repairCode: "unauthed_mono_repaired_to_hipped",
    };
  }
  return {
    roofIntent: input.roofIntent,
    roofIntentAuthored,
    rawForm,
    resolvedForm: input.roofIntent.form,
    source: roofIntentAuthored
      ? "object_first_authored"
      : "object_first_unauthed_default",
    repairCode: null,
  };
}

export type DerivedWallModel = {
  id: string;
  label: string;
  sourceFormIds: string[];
  edgeIds: string[];
  kind: "exterior";
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
  | "wall_perimeter"
  | "roof_perimeter"
  | "ridge"
  | "valley"
  | "eave"
  | "gutter";

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
  side: WorkbenchAttachmentSide;
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

/**
 * Deck world-space position overlay (stage 4 of the first-class-spatial-entities
 * migration). When set, the geometry pipeline applies this translation +
 * rotation to the deck's outline post-decode — independent of the house's
 * attachmentSide. The legacy decoder still runs against the active attachment
 * frame; `position` is an additive offset on top.
 *
 * Mirrors `HouseFormPosition` and `ObjectFirstPergolaPosition`.
 */
export type DeckPosition = {
  originXMm: string;
  originYMm: string;
  rotationDeg: string;
};

export type DeckObjectModel = {
  id: string;
  // PR-T9 (2026-05-29): `label`, `kind`, `elevationMode` removed with the
  // deck inspector cull. The left-rail list auto-derives "Deck 1", "Deck 2"
  // from index; nothing branched on `kind`; `elevationMode` only branched
  // on `'ground'` vs not-ground to clamp negative offsets.
  shape: DeckShape;
  presetType: DeckPresetType | null;
  presetRect?: DeckPresetRect | null;
  floatingRect?: DeckFloatingPresetRect | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  /** Optional world-space position overlay. See `DeckPosition`. */
  position?: DeckPosition | null;
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
    status: "valid" | "invalid";
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
    status: "valid" | "invalid";
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

/** What sort of object the pergola is snapped to. */
export type PergolaAttachmentSpatialKind =
  | "wall"
  | "roof_edge"
  | "pergola_outline"
  | "freestanding";

/**
 * How the pergola physically connects, given its `spatialKind`. Only writable
 * when `spatialKind === 'roof_edge'`; otherwise single-valued (derived).
 */
export type PergolaAttachmentMethod =
  | "facade_ledger"
  | "fascia_under_gutter"
  | "direct_to_soffit"
  | "soffit_brackets"
  | "none";

/** Family of object the pergola is snapped to (future-proof for pergola arrays). */
export type PergolaAttachmentHostFamily = "house_forms" | "pergolas";

/**
 * Resolved snap host. Derived from the snap engine's chosen target on the
 * commit that formed this attachment. `myEdgeIndex` is which edge of the
 * pergola's outline polygon is snapped — required so a re-solve can recover
 * the alignment without re-running the snap query.
 */
export type PergolaAttachmentHost = {
  objectFamily: PergolaAttachmentHostFamily;
  objectId: string;
  edgeKind: "wall" | "roof_eave" | "pergola_outline";
  edgeId: string;
  myEdgeIndex: number;
};

/**
 * Snap-derived pergola attachment. This is the workbench source of truth for
 * pergola-to-host connections. Older stored connection fields are projected
 * into this shape at normalization/edit boundaries; package geometry receives
 * a derived connection enum from `connectionTypeFromAttachment`.
 *
 * Invariants:
 * - `spatialKind === 'freestanding'` ⇔ `host === null` and `method === 'none'`.
 * - `spatialKind === 'wall'` ⇒ `method === 'facade_ledger'` (only valid choice).
 * - `spatialKind === 'pergola_outline'` ⇒ `method === 'none'` (v1 shared edges
 *   are coincident; bracket-to-pergola is a future feature).
 * - `spatialKind === 'roof_edge'` ⇒ `method ∈ { fascia_under_gutter,
 *   direct_to_soffit, soffit_brackets }` — the only spatialKind where the
 *   inspector exposes a method picker.
 * - For non-freestanding spatial kinds, `host` is normally a resolved
 *   `PergolaAttachmentHost`. Older stored drafts may carry only
 *   `connectionKind` + `strategy`; those normalize to `host === null` until
 *   the absolute host edge id is resolved through a snap. Geometry reads
 *   `spatialKind`/`method`; `host` is load-bearing for re-snap recovery and
 *   the UI inspector's host-edge label.
 *
 * `attachmentSide` (rear/front/left/right) becomes a derived UI label,
 * computed from the geometric relation between `host.edgeId` and the
 * pergola's outline; it is no longer stored on the pergola.
 */
export type PergolaAttachment = {
  host: PergolaAttachmentHost | null;
  spatialKind: PergolaAttachmentSpatialKind;
  method: PergolaAttachmentMethod;
};

export type PergolaObjectModel = {
  id: string;
  label: string;
  family: "mono" | "gable" | "box" | "hip" | "hip_corner" | "unknown";
  connectionKind?: ObjectFirstPergolaConnectionKind | null;
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  side: WorkbenchAttachmentSide;
  strategy: CalculatorHouseAttachmentStrategy | null;
  geometry?: ObjectFirstPergolaGeometryDraft | null;
  position?: ObjectFirstPergolaPosition | null;
  /**
   * Snap-derived attachment data. When present, this is the source of truth
   * for the pergola's relationship to the host. When null/undefined, older
   * stored `connectionKind` + `side` + `strategy` fields are normalized into
   * this shape on first edit.
   */
  attachment?: PergolaAttachment | null;
};

export type HouseAssemblyModel = {
  id: string;
  label: string;
  houseForms: HouseFormModel[];
  derivedEnvelope: DerivedBuildingEnvelopeModel | null;
};

export type ObjectFirstWorkbenchProjectModel = {
  source: "workbench_project_model" | "legacy_estimate_snapshot";
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
  // PR-COMP-PHASE2 (2026-06-18): mirrors `HouseFormModel.composition`.
  // Persisted JSON shape — undefined on legacy drafts; populated by
  // the Phase 3 rectangle tool.
  composition?: HouseComposition | null;
};

export type ObjectFirstHouseAssemblyDraft = {
  id: string;
  label: string;
  houseForms: ObjectFirstHouseFormDraft[];
};

export type DeckAttachmentSpatialKind = "wall" | "freestanding";

export type DeckAttachmentHost = {
  objectFamily: "house_forms";
  objectId: string;
  edgeKind: "wall";
  edgeId: string;
  myEdgeIndex: number;
};

/**
 * Snap-derived deck attachment. The source of truth for "which house wall is
 * this deck attached to". Mirrors `PergolaAttachment` but collapses the
 * method field because decks only attach via wall relationship.
 *
 * Invariants:
 * - `spatialKind === 'freestanding'` ⇔ `host === null`.
 * - `spatialKind === 'wall'` ⇒ `host !== null` and `host.edgeKind === 'wall'`.
 *
 * Older drafts may omit this field; normalization/read paths should keep
 * that case explicit instead of inventing committed geometry.
 */
export type DeckAttachment = {
  host: DeckAttachmentHost | null;
  spatialKind: DeckAttachmentSpatialKind;
};

export type ObjectFirstDeckDraft = {
  id: string;
  // PR-T9 (2026-05-29): `label`, `kind`, `elevationMode` removed with the
  // deck inspector cull. Persisted drafts carrying these fields are
  // silently dropped at the workbench draft normalize boundary.
  shape: DeckShape;
  presetType: DeckPresetType | null;
  presetRect?: DeckPresetRect | null;
  floatingRect?: DeckFloatingPresetRect | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  /** Optional world-space position overlay. See `DeckPosition` for details. */
  position?: DeckPosition | null;
  levelOffsetMm: string;
  isAttached: boolean;
  surfaceMaterial: DeckSurfaceMaterial;
  hostEdgeId: string | null;
  attachmentMode?: DeckAttachmentMode | null;
  primaryHostEdgeId?: string | null;
  secondaryHostEdgeId?: string | null;
  cornerVertexId?: string | null;
  /**
   * Snap-derived attachment, source of truth for which host wall this deck is
   * attached to. When present, per-form routing uses
   * `attachment.host.objectId`. Missing attachment is treated as unresolved
   * object-owned state, not as a committed fallback body.
   */
  attachment?: DeckAttachment | null;
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
  family: "mono" | "gable" | "box" | "hip" | "hip_corner" | "unknown";
  connectionKind?: ObjectFirstPergolaConnectionKind | null;
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  side: WorkbenchAttachmentSide;
  strategy: CalculatorHouseAttachmentStrategy | null;
  geometry?: ObjectFirstPergolaGeometryDraft | null;
  position?: ObjectFirstPergolaPosition | null;
  /** Snap-derived attachment data. See `PergolaAttachment` for invariants. */
  attachment?: PergolaAttachment | null;
};

export type ObjectFirstPergolaConnectionKind =
  | "freestanding"
  | "soffit"
  | "fascia"
  | "wall";

export type ObjectFirstPergolaGeometryDraft = {
  dimensions?: Partial<
    Record<
      "lengthM" | "projectionM" | "hipCornerLengthBM" | "hipCornerProjectionBM",
      string
    >
  >;
  roof?: Partial<{
    material: WorkbenchPergolaRoofMaterial;
    pitchDeg: string;
    boxPerimeterEnabled: boolean;
    mixedAcrylicBaysMain: string;
    mixedAcrylicBaysA: string;
    mixedAcrylicBaysB: string;
  }>;
  gable?: Partial<{
    endFramesMode: WorkbenchPergolaGableEndFramesMode;
    houseEaveGutterMode: WorkbenchPergolaHouseEdgeGutterMode;
    outerEaveGutterMode: WorkbenchPergolaHouseEdgeGutterMode;
  }>;
  supports?: Partial<{
    postConnectionType: WorkbenchPergolaPostConnectionType;
    ground: WorkbenchPergolaGroundCondition;
    postCount: string;
    postCutHeightM: string;
  }>;
  overrides?: Partial<WorkbenchPergolaOverrideProfiles>;
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
// - Workbench runtime consumes object-first project models and solved geometry artifacts.
// - `roofIntentAuthored` keeps imported/default roofs from becoming explicit user-authored roof overrides.

function trimNullableString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStableId(value: string | null | undefined): string | null {
  return trimNullableString(value);
}

function isHouseRoofPrimaryFallDirection(
  value: unknown,
): value is HouseRoofPrimaryFallDirection {
  return (
    value === "positive_x" ||
    value === "negative_x" ||
    value === "positive_y" ||
    value === "negative_y"
  );
}

function isHouseRoofRidgeAxis(value: unknown): value is HouseRoofRidgeAxis {
  return value === "x" || value === "y";
}

// PR-T8 (2026-05-29): `isHouseRoofAppendageForm` removed with the
// appendage feature cull.

function isCalculatorHouseStoreyMode(
  value: unknown,
): value is CalculatorHouseStoreyMode {
  return (
    value === "single_storey" || value === "double_storey" || value === "custom"
  );
}

function isCalculatorHouseAttachmentStrategy(
  value: unknown,
): value is CalculatorHouseAttachmentStrategy {
  return (
    value === "soffit_brackets" ||
    value === "fascia_under_gutter" ||
    value === "facade_ledger" ||
    value === "post_supported_tieback" ||
    value === "none"
  );
}

function isCalculatorHouseRoofMaterial(
  value: unknown,
): value is CalculatorHouseRoofMaterial {
  return (
    value === "corrugated_iron" ||
    value === "trapezoidal_5_rib" ||
    value === "eurotray_300" ||
    value === "eurotray_500" ||
    value === "shingles"
  );
}

// PR-T9 (2026-05-29): `isDeckKind` and `isDeckElevationMode` removed
// with the deck inspector cull.

function isDeckShape(value: unknown): value is DeckShape {
  return value === "preset" || value === "custom";
}

function isDeckPresetType(value: unknown): value is DeckPresetType {
  return value === "rect_attached" || value === "rect_detached";
}

function isDeckAttachmentMode(value: unknown): value is DeckAttachmentMode {
  return (
    value === "floating" ||
    value === "single_edge" ||
    value === "corner_dual_edge"
  );
}

function isDeckSurfaceMaterial(value: unknown): value is DeckSurfaceMaterial {
  return (
    value === "timber_decking" || value === "composite" || value === "concrete"
  );
}

function isPergolaFamily(
  value: unknown,
): value is ObjectFirstPergolaDraft["family"] {
  return (
    value === "mono" ||
    value === "gable" ||
    value === "box" ||
    value === "hip" ||
    value === "hip_corner" ||
    value === "unknown"
  );
}

function isObjectFirstPergolaConnectionKind(
  value: unknown,
): value is ObjectFirstPergolaConnectionKind {
  return (
    value === "freestanding" ||
    value === "soffit" ||
    value === "fascia" ||
    value === "wall"
  );
}

function isPortalRoofMaterial(
  value: unknown,
): value is WorkbenchPergolaRoofMaterial {
  return (
    value === "acrylic" ||
    value === "timber" ||
    value === "mixed" ||
    value === "insulated" ||
    value === "louvre"
  );
}

function isGableEndFramesMode(
  value: unknown,
): value is WorkbenchPergolaGableEndFramesMode {
  return (
    value === "none" || value === "outer_end_only" || value === "both_ends"
  );
}

function isHouseEdgeGutterMode(
  value: unknown,
): value is WorkbenchPergolaHouseEdgeGutterMode {
  return value === "house" || value === "our";
}

function isPostConnectionType(
  value: unknown,
): value is WorkbenchPergolaPostConnectionType {
  return (
    value === "pile_1m" ||
    value === "pile_1_5m" ||
    value === "deck_bracket" ||
    value === "slab_anchors"
  );
}

function isGroundCondition(
  value: unknown,
): value is WorkbenchPergolaGroundCondition {
  return value === "easy" || value === "hard";
}

function isWallOpeningHostSide(value: unknown): value is WallOpeningHostSide {
  return (
    value === "rear" ||
    value === "front" ||
    value === "left" ||
    value === "right"
  );
}

function normalizeHouseFormTransform(
  value: Partial<HouseFormTransformModel> | null | undefined,
): HouseFormTransformModel {
  return {
    offsetXM:
      typeof value?.offsetXM === "number" && Number.isFinite(value.offsetXM)
        ? value.offsetXM
        : 0,
    offsetYM:
      typeof value?.offsetYM === "number" && Number.isFinite(value.offsetYM)
        ? value.offsetYM
        : 0,
    rotationQuarterTurns: normalizeDrawingRotationQuarterTurns(
      value?.rotationQuarterTurns,
    ),
  };
}

function normalizeHouseFormPosition(
  value: Partial<HouseFormPosition> | null | undefined,
): HouseFormPosition | null {
  if (!value) return null;
  const originXMm = trimNullableString(value.originXMm);
  const originYMm = trimNullableString(value.originYMm);
  if (originXMm === null || originYMm === null) return null;
  return {
    originXMm,
    originYMm,
    rotationDeg: trimNullableString(value.rotationDeg) ?? "0",
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
    position: normalizeHouseFormPosition(value?.position ?? null),
  };
}

function normalizeHouseFormRoofIntent(
  value: Partial<HouseFormRoofIntentModel> | null | undefined,
  /**
   * Footprint polygon for the same house form. Required to migrate
   * legacy `form: 'gable'` records into the canonical
   * `form: 'hipped' + openGableEndIds: <all terminals>` shape -- the
   * geometry pipeline's normalize layer treats those two
   * representations as equivalent (`packages/geometry/src/normalize.ts:691-720`),
   * but UI consumers reading `roofIntent.openGableEndIds` directly
   * (rail labels, inspector toggles) saw `[]` while the geometry
   * rendered every end open -- the split caused the rail toggle bug
   * fixed in `8d0bf5ab`. Migrating at the draft boundary makes every
   * consumer read coherent state.
   *
   * Optional because the migration only applies when an explicit
   * polygon is available (custom-mode houses, or preset-mode houses
   * whose polygon has already been resolved). Preset-mode houses
   * without an explicit polygon stay `form: 'gable'` for now and rely
   * on the inspector model's `isOpen` derivation + the geometry compat
   * migration as a safety net. Retiring the geometry compat is slice
   * 2B and requires the migration to move to a later boundary that
   * always has the resolved polygon.
   */
  footprintPolygon?: ReadonlyArray<CalculatorHouseFootprintPolygonPoint>,
): HouseFormRoofIntentModel {
  const openGableEndIds = Array.isArray(value?.openGableEndIds)
    ? [
        ...new Set(
          value.openGableEndIds
            .filter(
              (candidate): candidate is string => typeof candidate === "string",
            )
            .map((candidate) => candidate.trim())
            .filter((candidate) => candidate.length > 0),
        ),
      ]
    : [];

  // Milestone 13 session C: legacy `'gable'` is no longer in
  // `HouseRoofForm`. Storage may still carry it -- detect at the
  // string level (cast to unknown to bypass the narrowed type) before
  // the validator narrows. When the polygon is available, seed
  // openGableEndIds with the all-ends-open set so the rendered
  // topology matches what gable-form houses produced before.
  const legacyGableInput = (value?.form as unknown) === "gable";
  const rawForm: HouseRoofForm = legacyGableInput
    ? "hipped"
    : isSupportedHouseRoofForm(value?.form)
      ? value.form
      : "hipped";
  const ridgeAxis = isHouseRoofRidgeAxis(value?.ridgeAxis)
    ? value.ridgeAxis
    : "x";

  // Milestone 13 deep migration (slice 2): when an explicit footprint
  // polygon is available AND we're migrating from legacy gable, seed
  // openGableEndIds with the full terminal set so the rendered
  // topology matches what gable-form houses produced before.
  if (legacyGableInput && footprintPolygon && footprintPolygon.length >= 3) {
    const polygonMm = footprintPolygon.map((point) => ({
      x: Number(point.alongM) * 1000,
      y: Number(point.depthM) * 1000,
      z: 0,
    }));
    const terminals = deriveHouseGableTerminalEnds({
      footprint: polygonMm,
      ridgeAxis,
    });
    const mergedOpenIds = [
      ...new Set([
        ...openGableEndIds,
        ...terminals.map((terminal) => terminal.id),
      ]),
    ];
    return {
      form: "hipped",
      material: isCalculatorHouseRoofMaterial(value?.material)
        ? value.material
        : DEFAULT_CALCULATOR_HOUSE_ROOF_MATERIAL,
      primaryPitchDeg: trimNullableString(value?.primaryPitchDeg) ?? "5",
      primaryFallDirection: isHouseRoofPrimaryFallDirection(
        value?.primaryFallDirection,
      )
        ? value.primaryFallDirection
        : "negative_y",
      ridgeAxis,
      openGableEndIds: mergedOpenIds,
      // PR-T8 (2026-05-29): `appendage` normalisation removed with the
      // appendage feature cull. Persisted JSON may still carry the field;
      // we silently drop it on read.
    };
  }

  return {
    form: rawForm,
    material: isCalculatorHouseRoofMaterial(value?.material)
      ? value.material
      : DEFAULT_CALCULATOR_HOUSE_ROOF_MATERIAL,
    primaryPitchDeg: trimNullableString(value?.primaryPitchDeg) ?? "5",
    primaryFallDirection: isHouseRoofPrimaryFallDirection(
      value?.primaryFallDirection,
    )
      ? value.primaryFallDirection
      : "negative_y",
    ridgeAxis,
    openGableEndIds,
    // PR-T8 (2026-05-29): same as above.
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
    widthM: widthM ?? "0",
    depthM: depthM ?? "0",
    centerOffsetM: centerOffsetM ?? "0",
    ...(trimNullableString(value.detachedGapM)
      ? { detachedGapM: trimNullableString(value.detachedGapM) }
      : null),
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
    centerAlongM: centerAlongM ?? "0",
    centerDepthM: centerDepthM ?? "0",
    widthM: widthM ?? "0",
    depthM: depthM ?? "0",
  };
}

/**
 * PR-COMP-PHASE2 (2026-06-18): defensive composition normalisation
 * for workbench-draft persistence.
 *
 * Runs `validateHouseComposition` on the persisted JSON. Returns
 * the composition when valid, `null` otherwise — bad / corrupt
 * composition data must never crash the workbench load; the form
 * gracefully falls back to its legacy `footprint.polygon`.
 *
 * v1: shallow structural validation only (closed-union error codes
 * from PR-COMP1). Does NOT cross-check composition coherence with
 * the legacy footprint field; per the vision, composition is the
 * source of truth when present and the polygon is when absent.
 */
function normalizeHouseComposition(
  value: HouseComposition | null | undefined,
): HouseComposition | null {
  if (!value) return null;
  const result = validateHouseComposition(value);
  if (!result.ok) return null;
  return value;
}

export function normalizeObjectFirstHouseFormDraft(
  value: Partial<ObjectFirstHouseFormDraft> | null | undefined,
): ObjectFirstHouseFormDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  const footprint = normalizeHouseFormFootprint(value?.footprint);
  const roofIntent = normalizeHouseFormRoofIntent(
    value?.roofIntent,
    footprint.polygon,
  );

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    transform: normalizeHouseFormTransform(value?.transform),
    footprint,
    // Pass the resolved footprint polygon so the roof-intent
    // normalizer can run the gable->hipped migration when an explicit
    // polygon is available. Empty polygon (preset-mode without
    // resolution) means migration is deferred; see comment inside
    // normalizeHouseFormRoofIntent.
    roofIntent,
    ...(value?.roofIntentAuthored === true
      ? { roofIntentAuthored: true }
      : null),
    storeyMode: isCalculatorHouseStoreyMode(value?.storeyMode)
      ? value.storeyMode
      : "single_storey",
    attachmentStrategy: isCalculatorHouseAttachmentStrategy(
      value?.attachmentStrategy,
    )
      ? value.attachmentStrategy
      : null,
    ...(trimNullableString(value?.eaveHeightM)
      ? { eaveHeightM: trimNullableString(value?.eaveHeightM) }
      : null),
    ...(trimNullableString(value?.wallHeightM)
      ? { wallHeightM: trimNullableString(value?.wallHeightM) }
      : null),
    ...(trimNullableString(value?.soffitDepthMm)
      ? { soffitDepthMm: trimNullableString(value?.soffitDepthMm) }
      : null),
    ...(trimNullableString(value?.fasciaHeightMm)
      ? { fasciaHeightMm: trimNullableString(value?.fasciaHeightMm) }
      : null),
    ...(trimNullableString(value?.gutterWidthMm)
      ? { gutterWidthMm: trimNullableString(value?.gutterWidthMm) }
      : null),
    ...(trimNullableString(value?.gutterDepthMm)
      ? { gutterDepthMm: trimNullableString(value?.gutterDepthMm) }
      : null),
    ...(trimNullableString(value?.gutterProjectionMm)
      ? { gutterProjectionMm: trimNullableString(value?.gutterProjectionMm) }
      : null),
    ...(trimNullableString(value?.eaveOverhangMm)
      ? { eaveOverhangMm: trimNullableString(value?.eaveOverhangMm) }
      : null),
    // PR-COMP-PHASE2: preserve composition if present + structurally
    // valid; drop silently otherwise (defensive — bad persisted data
    // must not crash workbench load).
    ...(normalizeHouseComposition(value?.composition)
      ? { composition: normalizeHouseComposition(value?.composition) }
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
    .filter((houseForm): houseForm is ObjectFirstHouseFormDraft =>
      Boolean(houseForm),
    );

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    houseForms,
  };
}

function normalizeDeckPosition(
  value: Partial<DeckPosition> | null | undefined,
): DeckPosition | null {
  if (!value) return null;
  const originXMm = trimNullableString(value.originXMm);
  const originYMm = trimNullableString(value.originYMm);
  if (originXMm === null || originYMm === null) return null;
  return {
    originXMm,
    originYMm,
    rotationDeg: trimNullableString(value.rotationDeg) ?? "0",
  };
}

export function normalizeObjectFirstDeckDraft(
  value: Partial<ObjectFirstDeckDraft> | null | undefined,
): ObjectFirstDeckDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;

  const position = normalizeDeckPosition(value?.position ?? null);
  // PR-T9 (2026-05-29): `label`, `kind`, `elevationMode` normalisation
  // removed with the deck inspector cull. Persisted JSON may still carry
  // these fields; they're silently dropped here.
  return {
    id,
    shape: isDeckShape(value?.shape) ? value.shape : "preset",
    presetType: isDeckPresetType(value?.presetType) ? value.presetType : null,
    ...(normalizeObjectFirstDeckPresetRect(value?.presetRect)
      ? { presetRect: normalizeObjectFirstDeckPresetRect(value?.presetRect) }
      : null),
    ...(normalizeObjectFirstDeckFloatingRect(value?.floatingRect)
      ? {
          floatingRect: normalizeObjectFirstDeckFloatingRect(
            value?.floatingRect,
          ),
        }
      : null),
    outline: normalizeHouseFootprintPolygon(value?.outline),
    ...(position ? { position } : null),
    levelOffsetMm: trimNullableString(value?.levelOffsetMm) ?? "0",
    isAttached:
      typeof value?.isAttached === "boolean" ? value.isAttached : true,
    surfaceMaterial: isDeckSurfaceMaterial(value?.surfaceMaterial)
      ? value.surfaceMaterial
      : "timber_decking",
    hostEdgeId: normalizeStableId(value?.hostEdgeId),
    ...(isDeckAttachmentMode(value?.attachmentMode)
      ? { attachmentMode: value.attachmentMode }
      : null),
    ...(normalizeStableId(value?.primaryHostEdgeId)
      ? { primaryHostEdgeId: normalizeStableId(value?.primaryHostEdgeId) }
      : null),
    ...(normalizeStableId(value?.secondaryHostEdgeId)
      ? { secondaryHostEdgeId: normalizeStableId(value?.secondaryHostEdgeId) }
      : null),
    ...(normalizeStableId(value?.cornerVertexId)
      ? { cornerVertexId: normalizeStableId(value?.cornerVertexId) }
      : null),
    // PR-D (2026-05-22): preserve `attachment` (the snap-derived host
    // reference) through normalization. Replaces the PR9 `hostHouseFormId`
    // routing band-aid which was deleted. The host object id is now read
    // from `attachment.host.objectId` by the read path's per-form filter.
    ...(normalizeDeckAttachment(value?.attachment) !== undefined
      ? { attachment: normalizeDeckAttachment(value?.attachment) }
      : null),
  };
}

function normalizeDeckAttachment(
  value: DeckAttachment | null | undefined,
): DeckAttachment | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value.spatialKind === "freestanding") {
    return { host: null, spatialKind: "freestanding" };
  }
  if (value.spatialKind === "wall") {
    const hostObjectId = normalizeStableId(value.host?.objectId);
    if (!hostObjectId) {
      // Wall spatialKind without a host object: degrade to freestanding
      // rather than persist a partial reference.
      return { host: null, spatialKind: "freestanding" };
    }
    // PR-D (2026-05-22): `host.edgeId` can be empty when the snap has not
    // resolved yet (e.g., deck just added via rail with the host form known
    // but no wall-edge snap committed). PR-F's snap migration populates this
    // properly when the user drags the deck to a wall. Until then, an empty
    // edgeId is valid — the read path uses `host.objectId` for routing and
    // falls back to legacy `hostEdgeId` (AttachmentSide) for wall geometry.
    return {
      host: {
        objectFamily: "house_forms",
        objectId: hostObjectId,
        edgeKind: "wall",
        edgeId: normalizeStableId(value.host?.edgeId) ?? "",
        myEdgeIndex:
          typeof value.host?.myEdgeIndex === "number"
            ? value.host.myEdgeIndex
            : 0,
      },
      spatialKind: "wall",
    };
  }
  return null;
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
    widthM: trimNullableString(value?.widthM) ?? "0",
    heightM: trimNullableString(value?.heightM) ?? "0",
    sillHeightM: trimNullableString(value?.sillHeightM) ?? "0",
    offsetAlongWallM: trimNullableString(value?.offsetAlongWallM) ?? "0",
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
    "lengthM",
    "projectionM",
    "hipCornerLengthBM",
    "hipCornerProjectionBM",
  ]);
  const roofStringFields = normalizePergolaGeometryStringFields(value.roof, [
    "pitchDeg",
    "mixedAcrylicBaysMain",
    "mixedAcrylicBaysA",
    "mixedAcrylicBaysB",
  ]);
  const roof: ObjectFirstPergolaGeometryDraft["roof"] = {
    ...(roofStringFields ?? {}),
    ...(isPortalRoofMaterial(value.roof?.material)
      ? { material: value.roof.material }
      : null),
    ...(typeof value.roof?.boxPerimeterEnabled === "boolean"
      ? { boxPerimeterEnabled: value.roof.boxPerimeterEnabled }
      : null),
  };
  const gable: ObjectFirstPergolaGeometryDraft["gable"] = {
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
  const supportStringFields = normalizePergolaGeometryStringFields(
    value.supports,
    ["postCount", "postCutHeightM"],
  );
  const supports: ObjectFirstPergolaGeometryDraft["supports"] = {
    ...(supportStringFields ?? {}),
    ...(isPostConnectionType(value.supports?.postConnectionType)
      ? { postConnectionType: value.supports.postConnectionType }
      : null),
    ...(isGroundCondition(value.supports?.ground)
      ? { ground: value.supports.ground }
      : null),
  };
  const overrides = normalizePergolaGeometryStringFields(value.overrides, [
    "ledgerProfile",
    "rafterProfile",
    "postProfile",
    "frontBeamProfile",
    "ridgeBeamProfile",
    "boxPerimeterBeamProfile",
    "tieBeamProfile",
    "strutProfile",
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
    rotationDeg: trimNullableString(value.rotationDeg) ?? "0",
  };
}

const PERGOLA_ATTACHMENT_SPATIAL_KINDS: ReadonlySet<PergolaAttachmentSpatialKind> =
  new Set(["wall", "roof_edge", "pergola_outline", "freestanding"]);

const PERGOLA_ATTACHMENT_METHODS: ReadonlySet<PergolaAttachmentMethod> =
  new Set([
    "facade_ledger",
    "fascia_under_gutter",
    "direct_to_soffit",
    "soffit_brackets",
    "none",
  ]);

const PERGOLA_ATTACHMENT_HOST_FAMILIES: ReadonlySet<PergolaAttachmentHostFamily> =
  new Set(["house_forms", "pergolas"]);

const PERGOLA_ATTACHMENT_HOST_EDGE_KINDS: ReadonlySet<
  PergolaAttachmentHost["edgeKind"]
> = new Set(["wall", "roof_eave", "pergola_outline"]);

function isPergolaAttachmentSpatialKind(
  value: unknown,
): value is PergolaAttachmentSpatialKind {
  return (
    typeof value === "string" &&
    PERGOLA_ATTACHMENT_SPATIAL_KINDS.has(value as PergolaAttachmentSpatialKind)
  );
}

function isPergolaAttachmentMethod(
  value: unknown,
): value is PergolaAttachmentMethod {
  return (
    typeof value === "string" &&
    PERGOLA_ATTACHMENT_METHODS.has(value as PergolaAttachmentMethod)
  );
}

function isPergolaAttachmentHostFamily(
  value: unknown,
): value is PergolaAttachmentHostFamily {
  return (
    typeof value === "string" &&
    PERGOLA_ATTACHMENT_HOST_FAMILIES.has(value as PergolaAttachmentHostFamily)
  );
}

function isPergolaAttachmentHostEdgeKind(
  value: unknown,
): value is PergolaAttachmentHost["edgeKind"] {
  return (
    typeof value === "string" &&
    PERGOLA_ATTACHMENT_HOST_EDGE_KINDS.has(
      value as PergolaAttachmentHost["edgeKind"],
    )
  );
}

function normalizePergolaAttachmentHost(
  value: Partial<PergolaAttachmentHost> | null | undefined,
): PergolaAttachmentHost | null {
  if (!value) return null;
  const objectFamily = isPergolaAttachmentHostFamily(value.objectFamily)
    ? value.objectFamily
    : null;
  const objectId = normalizeStableId(value.objectId);
  const edgeKind = isPergolaAttachmentHostEdgeKind(value.edgeKind)
    ? value.edgeKind
    : null;
  const edgeId = normalizeStableId(value.edgeId);
  const myEdgeIndex =
    typeof value.myEdgeIndex === "number" &&
    Number.isFinite(value.myEdgeIndex) &&
    value.myEdgeIndex >= 0
      ? Math.floor(value.myEdgeIndex)
      : null;
  if (
    !objectFamily ||
    !objectId ||
    !edgeKind ||
    !edgeId ||
    myEdgeIndex === null
  )
    return null;
  return { objectFamily, objectId, edgeKind, edgeId, myEdgeIndex };
}

/**
 * Normalize a `PergolaAttachment`, defending the invariants tied to
 * spatialKind/method/host. If the input is malformed in a way that breaks the
 * invariants (e.g. spatialKind=freestanding but host is set), prefer dropping
 * the contradictory field rather than rejecting the whole attachment — the
 * legacy fields will fill the gap.
 */
export function normalizePergolaAttachment(
  value: Partial<PergolaAttachment> | null | undefined,
): PergolaAttachment | null {
  if (!value) return null;
  const spatialKind = isPergolaAttachmentSpatialKind(value.spatialKind)
    ? value.spatialKind
    : null;
  if (!spatialKind) return null;
  const host =
    spatialKind === "freestanding"
      ? null
      : normalizePergolaAttachmentHost(value.host ?? null);
  // Method must be valid for the spatialKind. Coerce to the canonical method
  // when there's only one valid choice; preserve user picks for roof_edge.
  let method: PergolaAttachmentMethod;
  const rawMethod = isPergolaAttachmentMethod(value.method)
    ? value.method
    : null;
  switch (spatialKind) {
    case "freestanding":
      method = "none";
      break;
    case "wall":
      method = "facade_ledger";
      break;
    case "pergola_outline":
      method = "none";
      break;
    case "roof_edge": {
      const validRoofEdgeMethods: PergolaAttachmentMethod[] = [
        "fascia_under_gutter",
        "direct_to_soffit",
        "soffit_brackets",
      ];
      method =
        rawMethod && validRoofEdgeMethods.includes(rawMethod)
          ? rawMethod
          : "fascia_under_gutter";
      break;
    }
    default:
      method = "none";
  }
  return { host, spatialKind, method };
}

export function normalizeObjectFirstPergolaDraft(
  value: Partial<ObjectFirstPergolaDraft> | null | undefined,
): ObjectFirstPergolaDraft | null {
  const id = normalizeStableId(value?.id);
  if (!id) return null;
  const geometry = normalizeObjectFirstPergolaGeometryDraft(value?.geometry);
  const position = normalizeObjectFirstPergolaPosition(value?.position ?? null);
  const attachment = normalizePergolaAttachment(value?.attachment ?? null);

  return {
    id,
    label: trimNullableString(value?.label) ?? id,
    family: isPergolaFamily(value?.family) ? value.family : "unknown",
    ...(isObjectFirstPergolaConnectionKind(value?.connectionKind)
      ? { connectionKind: value.connectionKind }
      : null),
    attachmentEdgeId: normalizeStableId(value?.attachmentEdgeId),
    attachmentZoneId: normalizeStableId(value?.attachmentZoneId),
    side: normalizeAttachmentSide(value?.side),
    strategy: isCalculatorHouseAttachmentStrategy(value?.strategy)
      ? value.strategy
      : null,
    ...(geometry ? { geometry } : null),
    ...(position ? { position } : null),
    ...(attachment ? { attachment } : null),
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
      .filter((opening): opening is ObjectFirstOpeningDraft =>
        Boolean(opening),
      ),
    pergolas: (value?.pergolas ?? [])
      .map((pergola) => normalizeObjectFirstPergolaDraft(pergola))
      .filter((pergola): pergola is ObjectFirstPergolaDraft =>
        Boolean(pergola),
      ),
  };
}

export const EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT: ObjectFirstWorkbenchDraftVNext =
  {
    houseAssembly: null,
    decks: [],
    openings: [],
    pergolas: [],
  };

export const EMPTY_WORKBENCH_PROJECT_MODEL: WorkbenchProjectModel = {
  source: "workbench_project_model",
  houseAssembly: null,
  decks: [],
  openings: [],
  pergolas: [],
  warnings: [],
};

export function buildWorkbenchProjectModelFromObjectFirstDraft(
  value: Partial<ObjectFirstWorkbenchDraftVNext> | null | undefined,
): WorkbenchProjectModel {
  const draft = normalizeObjectFirstWorkbenchDraftVNext(value);
  return {
    source: "workbench_project_model",
    houseAssembly: draft.houseAssembly
      ? {
          id: draft.houseAssembly.id,
          label: draft.houseAssembly.label,
          houseForms: draft.houseAssembly.houseForms.map((houseForm) => ({
            ...houseForm,
          })),
          derivedEnvelope: null,
        }
      : null,
    decks: draft.decks.map((deck) => ({ ...deck })),
    openings: draft.openings.map((opening) => ({ ...opening })),
    pergolas: draft.pergolas.map((pergola) => ({ ...pergola })),
    warnings: [],
  };
}
