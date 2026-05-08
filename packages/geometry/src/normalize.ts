import type {
  AssemblyPosition,
  AttachmentSide,
  AssemblyMemberProfile,
  BoxGutterMode,
  ConnectionType,
  FootingType,
  GableEaveGutterMode,
  GableEndFramesMode,
  GutterAssemblyMode,
  GeometryConfig,
  HouseAttachmentStrategy,
  HouseDeckConfig,
  HouseFootprintMode,
  HouseFootprintPreset,
  HouseModelConfig,
  HouseOpeningConfig,
  HouseRoofAppendageForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  HouseRoofForm,
  HouseRoofMaterial,
  HouseStoreyMode,
  HouseWallConstruction,
  RawGableEaveGutterMode,
  RawGableEndFramesMode,
  RawBoxGutterMode,
  RawGeometryModuleInput,
  RoofFallDirection,
  RoofMaterial,
} from './contracts';
import {
  buildCustomHouseFootprintPolygon,
  buildHouseFootprintPolygon,
  houseFootprintSideLocalToWorldPolygon,
  resolveHouseFootprintFrame,
} from './footprints';
import { normalizeHouseRoofPitchDegForForm } from './houseRoofValidation';
import { deriveHouseGableTerminalEndsFromFootprint } from './house/roofJoined';
import { makeDatumFrame } from './math3d';
import { parseAssemblyMemberProfile } from './profiles';
import {
  metresToMillimetres,
  parseFiniteNumber,
  parseNonNegativeInteger,
  parseNonNegativeNumber,
  parsePositiveNumber,
} from './units';

export type NormalizeGeometryConfigErrorCode = 'unsupported_family' | 'unsupported_variant' | 'missing_required_input' | 'invalid_numeric_input';

export type NormalizeGeometryConfigResult =
  | {
      ok: true;
      value: GeometryConfig;
    }
  | {
      ok: false;
      code: NormalizeGeometryConfigErrorCode;
      error: string;
    };

function ok(value: GeometryConfig): NormalizeGeometryConfigResult {
  return { ok: true, value };
}

function fail(code: NormalizeGeometryConfigErrorCode, error: string): NormalizeGeometryConfigResult {
  return { ok: false, code, error };
}

const BOX_HOUSE_SETBACK_MM = 150;
const BOX_OUTER_SETBACK_MM = 50;
const DEFAULT_HOUSE_EAVE_HEIGHT_MM = 2400;
const DEFAULT_HOUSE_ROOF_PITCH_DEG = 25;
const DEFAULT_HOUSE_SOFFIT_DEPTH_MM = 450;
const DEFAULT_HOUSE_FASCIA_HEIGHT_MM = 180;
const DEFAULT_HOUSE_GUTTER_WIDTH_MM = 125;
const DEFAULT_HOUSE_GUTTER_DEPTH_MM = 90;
const DEFAULT_HOUSE_GUTTER_PROJECTION_MM = 125;
const DEFAULT_HOUSE_EAVE_OVERHANG_MM = 450;
const DEFAULT_HOUSE_ROOF_MATERIAL: HouseRoofMaterial = 'corrugated_iron';

function resolveFamily(input: RawGeometryModuleInput): GeometryConfig['family'] | null {
  if (input.pergolaStyle === 'pitched') {
    return input.boxPerimeterEnabled ? 'box' : 'mono';
  }
  if (input.pergolaStyle === 'gable') return 'gable';
  if (input.pergolaStyle === 'hip') return 'hip';
  if (input.pergolaStyle === 'hip_corner') return 'hip_corner';
  return null;
}

function resolveAttachmentSide(side: AttachmentSide | null | undefined): AttachmentSide {
  if (side === 'front' || side === 'left' || side === 'right') return side;
  return 'rear';
}

function resolveConnectionType(value: RawGeometryModuleInput['connection']['houseConnectionType']): ConnectionType {
  if (value === 'none' || value === 'freestanding') return 'freestanding';
  if (value === 'facade' || value === 'wall') return 'wall';
  if (value === 'fascia') return 'fascia';
  return 'soffit';
}

function resolveHouseStoreyMode(value: HouseStoreyMode | null | undefined): HouseStoreyMode {
  if (value === 'double_storey' || value === 'custom') return value;
  return 'single_storey';
}

function resolveHouseWallConstruction(value: HouseWallConstruction | null | undefined): HouseWallConstruction {
  if (value === 'timber_frame') return value;
  return 'timber_frame';
}

function resolveHouseRoofForm(value: HouseRoofForm | null | undefined): HouseRoofForm {
  if (value === 'flat' || value === 'mono' || value === 'gable' || value === 'hipped') {
    return value;
  }
  return 'hipped';
}

function resolveHouseRoofPrimaryFallDirection(
  value: HouseRoofPrimaryFallDirection | null | undefined,
): HouseRoofPrimaryFallDirection {
  if (
    value === 'negative_x' ||
    value === 'positive_x' ||
    value === 'negative_y'
  ) {
    return value;
  }
  return 'positive_y';
}

function resolveHouseRoofRidgeAxis(
  value: HouseRoofRidgeAxis | null | undefined,
): HouseRoofRidgeAxis {
  return value === 'y' ? 'y' : 'x';
}

function resolveHouseOpeningPanelCount(
  kind: 'window' | 'hinged_door' | 'slider' | 'stacker',
  value: unknown,
): 2 | 3 | 4 | null {
  if (kind !== 'slider') return null;
  const parsed =
    typeof value === 'string'
      ? Number.parseInt(value, 10)
      : typeof value === 'number'
        ? Math.round(value)
        : NaN;
  return parsed === 3 || parsed === 4 ? parsed : 2;
}

function resolveHouseOpenGableEndIds(
  value: string[] | null | undefined,
): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
  return ids.length ? [...new Set(ids)] : null;
}

function resolveHouseRoofAppendageForm(
  value: HouseRoofAppendageForm | null | undefined,
): HouseRoofAppendageForm {
  return value === 'flat' ? 'flat' : 'mono';
}

function resolveHouseRoofMaterial(value: HouseRoofMaterial | null | undefined): HouseRoofMaterial {
  if (
    value === 'trapezoidal_5_rib' ||
    value === 'eurotray_300' ||
    value === 'eurotray_500' ||
    value === 'shingles'
  ) {
    return value;
  }
  return DEFAULT_HOUSE_ROOF_MATERIAL;
}

function resolveHouseAttachmentStrategy(
  value: HouseAttachmentStrategy | null | undefined,
  connectionType: ConnectionType,
): HouseAttachmentStrategy {
  if (
    value === 'soffit_brackets' ||
    value === 'fascia_under_gutter' ||
    value === 'facade_ledger' ||
    value === 'post_supported_tieback' ||
    value === 'none'
  ) {
    return value;
  }

  if (connectionType === 'freestanding') return 'none';
  if (connectionType === 'wall') return 'facade_ledger';
  if (connectionType === 'fascia') return 'fascia_under_gutter';
  return 'soffit_brackets';
}

function resolveRoofMaterial(input: RawGeometryModuleInput): { material: RoofMaterial; mode?: string | null } {
  if (input.roof.material === 'mixed') {
    return {
      material: 'timber',
      mode: input.roof.mode ?? 'mixed',
    };
  }
  if (input.roof.material === 'insulated' || input.roof.material === 'louvre') {
    return {
      material: input.roof.material,
      mode: input.roof.mode ?? null,
    };
  }
  return {
    material: input.roof.material,
    mode: input.roof.mode ?? null,
  };
}

function resolveFallDirection(input: RawGeometryModuleInput, family: GeometryConfig['family']): RoofFallDirection {
  if (family === 'gable' || family === 'hip') return 'dual';
  const slopeDirection = input.derived?.slopeDirection ?? input.roof.slopeDirection ?? 'away_from_house';
  return slopeDirection === 'toward_house' ? 'negativeY' : 'positiveY';
}

function resolveFootingType(value: RawGeometryModuleInput['supports']['postConnectionType']): FootingType | null {
  if (value === 'slab_anchors') return 'slab';
  if (value === 'pile_1m' || value === 'pile_1_5m') return 'pile';
  return null;
}

function resolveDimensionMm(input: {
  label: string;
  derivedValue?: number | null;
  rawValue?: string | number | null;
}): { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } {
  const derivedValue = parsePositiveNumber(input.derivedValue);
  if (derivedValue !== null) {
    return { ok: true, value: metresToMillimetres(derivedValue) };
  }

  const rawParsed = parsePositiveNumber(input.rawValue);
  if (rawParsed !== null) {
    return { ok: true, value: metresToMillimetres(rawParsed) };
  }

  const hasAnyRaw = input.rawValue !== undefined && input.rawValue !== null && String(input.rawValue).trim() !== '';
  const hasAnyDerived = typeof input.derivedValue === 'number';
  if (hasAnyRaw || hasAnyDerived) {
    return {
      ok: false,
      code: 'invalid_numeric_input',
      error: `Enter a valid ${input.label}.`,
    };
  }

  return {
    ok: false,
    code: 'missing_required_input',
    error: `${input.label} is required.`,
  };
}

function resolvePitchDeg(input: RawGeometryModuleInput): { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } {
  const derivedValue = parseNonNegativeNumber(input.derived?.roofPitchDeg);
  if (derivedValue !== null) {
    return { ok: true, value: derivedValue };
  }

  const rawParsed = parseNonNegativeNumber(input.roof.roofPitchDeg);
  if (rawParsed !== null) {
    return { ok: true, value: rawParsed };
  }

  const hasAnyRaw = input.roof.roofPitchDeg !== undefined && input.roof.roofPitchDeg !== null && String(input.roof.roofPitchDeg).trim() !== '';
  const hasAnyDerived = typeof input.derived?.roofPitchDeg === 'number';
  if (hasAnyRaw || hasAnyDerived) {
    return {
      ok: false,
      code: 'invalid_numeric_input',
      error: 'Enter a valid roof pitch.',
    };
  }

  return {
    ok: false,
    code: 'missing_required_input',
    error: 'roof pitch is required.',
  };
}

function resolvePostCutHeightMm(value: RawGeometryModuleInput['supports']['postCutHeightM']): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = parsePositiveNumber(value);
  if (parsed === null) {
    return null;
  }

  return metresToMillimetres(parsed);
}

function resolveOverhangMm(input: RawGeometryModuleInput): { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } {
  if (!input.roof.overhangEnabled) {
    return { ok: true, value: 0 };
  }

  const parsed = parseNonNegativeNumber(input.roof.overhangM);
  if (parsed !== null) {
    return { ok: true, value: metresToMillimetres(parsed) };
  }

  const hasAnyRaw = input.roof.overhangM !== undefined && input.roof.overhangM !== null && String(input.roof.overhangM).trim() !== '';
  if (hasAnyRaw) {
    return {
      ok: false,
      code: 'invalid_numeric_input',
      error: 'Enter a valid overhang.',
    };
  }

  return {
    ok: false,
    code: 'missing_required_input',
    error: 'overhang amount is required.',
  };
}

function resolveStructuralHeightMm(value: string | number | null | undefined): number | null {
  const parsed = parsePositiveNumber(value);
  return parsed === null ? null : metresToMillimetres(parsed);
}

function resolveStructuralProfile(value: string | null | undefined): AssemblyMemberProfile | null {
  return parseAssemblyMemberProfile(value);
}

function resolveRafterCount(value: string | number | null | undefined): number | null {
  const parsed = parseNonNegativeInteger(value);
  if (parsed === null || parsed < 2) {
    return null;
  }
  return parsed;
}

function resolveRafterSpacingMm(value: string | number | null | undefined): number | null {
  const parsed = parsePositiveNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function resolveGutterAssemblyMode(value: GutterAssemblyMode | null | undefined): GutterAssemblyMode | null {
  if (value === 'integrated' || value === 'separate' || value === 'none') {
    return value;
  }
  return null;
}

function resolveGableEndFramesMode(value: RawGableEndFramesMode | null | undefined): GableEndFramesMode | null {
  if (value === 'none' || value === 'outer_end_only' || value === 'both_ends') {
    return value;
  }
  return null;
}

function resolveGableEaveGutterMode(
  value: RawGableEaveGutterMode | null | undefined,
): GableEaveGutterMode | null {
  if (value === 'house' || value === 'our') {
    return value;
  }
  return null;
}

function resolveBoxGutterMode(value: RawBoxGutterMode | null | undefined): BoxGutterMode | null {
  if (value === 'house' || value === 'our' || value === 'none') {
    return value;
  }
  return null;
}

function resolveOptionalMillimetres(value: string | number | null | undefined): number | null {
  const parsed = parseNonNegativeNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function resolveOptionalMetresToMillimetres(value: string | number | null | undefined): number | null {
  const parsed = parsePositiveNumber(value);
  return parsed === null ? null : metresToMillimetres(parsed);
}

function resolveOptionalDegrees(value: string | number | null | undefined): number | null {
  return parseNonNegativeNumber(value);
}

function resolveMillimetresWithDefault(value: string | number | null | undefined, fallback: number): number {
  return resolveOptionalMillimetres(value) ?? fallback;
}

function resolveOptionalSquareMetresToSquareMillimetres(value: number | null | undefined): number | null {
  const parsed = parseNonNegativeNumber(value);
  return parsed === null ? null : Math.round(parsed * 1_000_000);
}

function resolveOptionalCount(value: string | number | null | undefined): number | null {
  return parseNonNegativeInteger(value);
}

/**
 * Apply a world-space `AssemblyPosition` (translation + rotation around +Z)
 * to a 3D polygon. Used by the house first-class spatial entity decoder to
 * lift a unit-frame-decoded polygon into world space.
 */
function applyPositionToPolygon3(
  polygon: GeometryConfig['houseContext']['footprint'],
  position: AssemblyPosition,
): GeometryConfig['houseContext']['footprint'] {
  if (!polygon) return polygon;
  const radians = (position.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return polygon.map((point) => ({
    x: position.origin.x + cos * point.x - sin * point.y,
    y: position.origin.y + sin * point.x + cos * point.y,
    z: point.z,
  }));
}

function resolveOptionalAssemblyPosition(
  raw: RawGeometryModuleInput['position'],
): AssemblyPosition | null {
  if (!raw) return null;
  // Position origins are world-space coordinates and CAN BE NEGATIVE — a
  // pergola can sit at world.x = -500. The previous use of
  // `resolveOptionalMillimetres` (which calls `parseNonNegativeNumber`)
  // silently rejected negative values, returning null and dropping the entire
  // position. The visible symptom: dragging a pergola's left/top wall outward
  // wrote a negative origin → position resolved to null → pergola stayed at
  // world (0, 0) → user saw "drag doesn't always resize."
  const xParsed = parseFiniteNumber(raw.origin?.x);
  const yParsed = parseFiniteNumber(raw.origin?.y);
  const rotationDeg = parseFiniteNumber(raw.rotationDeg);
  if (xParsed === null || yParsed === null) return null;
  return {
    origin: { x: Math.round(xParsed), y: Math.round(yParsed) },
    rotationDeg: rotationDeg ?? 0,
  };
}

function resolveFootprintPreset(value: HouseFootprintPreset | null | undefined): HouseFootprintPreset {
  if (
    value === 'l_left' ||
    value === 'l_right' ||
    value === 'recess_left' ||
    value === 'recess_right' ||
    value === 'u_shape' ||
    value === 'wrap_left' ||
    value === 'wrap_right'
  ) {
    return value;
  }
  return 'straight';
}

function resolveFootprintMode(value: HouseFootprintMode | 'orthogonal_polygon' | null | undefined): HouseFootprintMode {
  return value === 'custom_polygon' || value === 'orthogonal_polygon' ? 'custom_polygon' : 'preset';
}

/**
 * Normalize the raw `houseContext` (or, post-milestone-13, a structurally
 * equivalent `RawHouseInput`) into a `HouseModelConfig`. Exported so the
 * project-level house orchestrator can call this once per project rather
 * than going through the per-pergola `normalize.ts` entry.
 */
export function buildHouseModelConfig(input: {
  rawHouseContext: RawGeometryModuleInput['houseContext'];
  footprint: GeometryConfig['houseContext']['footprint'];
  connectionType: ConnectionType;
  attachmentSide: AttachmentSide;
  houseUndersideMm: number | null;
  referenceUndersideMm: number | null;
}): HouseModelConfig | null {
  if (input.connectionType === 'freestanding' || !input.footprint) {
    return null;
  }

  const eaveHeightMm =
    resolveOptionalMetresToMillimetres(input.rawHouseContext.eaveHeightM) ??
    input.referenceUndersideMm ??
    input.houseUndersideMm ??
    DEFAULT_HOUSE_EAVE_HEIGHT_MM;
  const wallHeightMm = resolveOptionalMetresToMillimetres(input.rawHouseContext.wallHeightM) ?? eaveHeightMm;
  // Milestone 13 session C: legacy `roofForm: 'gable'` data migrates to
  // `'hipped'` + all-terminal-ends-open. Sessions A and B made hipped
  // honour `openGableEndIds` for per-end topology, so a "fully open"
  // hipped roof is geometrically identical to the legacy gable rectangle
  // and produces the bent-spine joined gable for L-shapes via the same
  // wavefront mechanism. The migration converts the FORM at normalize
  // time so all downstream consumers see only the new model; the type
  // narrowing of `HouseRoofForm` to drop `'gable'` is a separate slice
  // (retiring the storage shape after the migration is verified live).
  const rawRoofForm = resolveHouseRoofForm(input.rawHouseContext.roofForm);
  const roofForm: HouseRoofForm = rawRoofForm === 'gable' ? 'hipped' : rawRoofForm;
  const roofPitchDeg = normalizeHouseRoofPitchDegForForm({
    roofForm,
    pitchDeg: resolveOptionalDegrees(input.rawHouseContext.roofPitchDeg),
    fallbackPitchDeg: DEFAULT_HOUSE_ROOF_PITCH_DEG,
  });
  const rawEave = input.rawHouseContext.eave;
  const deckFrame = resolveHouseFootprintFrame({
    pergolaWidthMm: 1000,
    pergolaDepthMm: 1000,
    attachmentSide: input.attachmentSide,
  });
  const decks: HouseDeckConfig[] =
    (input.rawHouseContext.decks ?? [])
      .map((deck): HouseDeckConfig | null => {
        if (!deck?.id) return null;
        const outlinePoints = (deck.outline ?? [])
          .map((point) => ({
            alongM: parseFiniteNumber(point.alongM),
            depthM: parseFiniteNumber(point.depthM),
          }))
          .filter(
            (
              point,
            ): point is {
              alongM: number;
              depthM: number;
            } => point.alongM !== null && point.depthM !== null,
          );
        return {
          id: deck.id,
          name: deck.name ?? null,
          kind: deck.kind === 'landing' ? 'landing' : 'deck',
          shape: deck.shape === 'custom' ? 'custom' : 'preset',
          presetType:
            deck.presetType === 'rect_attached' || deck.presetType === 'rect_detached'
              ? deck.presetType
              : null,
          presetRect:
            deck.presetRect &&
            resolveOptionalMillimetres(deck.presetRect.widthMm) !== null &&
            resolveOptionalMillimetres(deck.presetRect.depthMm) !== null &&
            resolveOptionalMillimetres(deck.presetRect.centerOffsetMm) !== null
              ? {
                  widthMm: resolveOptionalMillimetres(deck.presetRect.widthMm) ?? 0,
                  depthMm: resolveOptionalMillimetres(deck.presetRect.depthMm) ?? 0,
                  centerOffsetMm: resolveOptionalMillimetres(deck.presetRect.centerOffsetMm) ?? 0,
                  detachedGapMm: resolveOptionalMillimetres(deck.presetRect.detachedGapMm) ?? 0,
                }
              : null,
          outline: (() => {
            if (outlinePoints.length < 3) return null;
            const deckPosition = resolveOptionalAssemblyPosition(deck.position);
            // Stage 4.5 — when the deck has a `position` set, decode against a
            // standardized `'rear'` frame so the deck is decoupled from the
            // host's current `attachmentSide`. Pairs with the same standardization
            // in `DesignWorkbenchEstimateClient`'s deck commit handler — both
            // sides use 'rear' so the round-trip is consistent.
            //
            // When `position` is null (legacy data, no edits yet), fall back to
            // the host-attachmentSide-aware `deckFrame` for back-compat.
            const decoderFrame = deckPosition
              ? resolveHouseFootprintFrame({
                  pergolaWidthMm: 1000,
                  pergolaDepthMm: 1000,
                  attachmentSide: 'rear',
                })
              : deckFrame;
            const decoded = houseFootprintSideLocalToWorldPolygon({
              points: outlinePoints,
              frame: decoderFrame,
              resolved: {
                widthM: 1,
                offsetXM: 0,
                setbackM: 0,
                bandDepthM: 1,
                returnRunM: 1,
                recessWidthM: 1,
                recessDepthM: 1,
                leftLegRunM: 1,
                rightLegRunM: 1,
                sideRunM: 1,
              },
            });
            return deckPosition
              ? applyPositionToPolygon3(decoded, deckPosition)
              : decoded;
          })(),
          elevationMode:
            deck.elevationMode === 'aligned_to_threshold' || deck.elevationMode === 'stepped'
              ? deck.elevationMode
              : 'ground',
          levelOffsetMm: resolveOptionalMillimetres(deck.levelOffsetMm),
          topSurfaceElevationMm:
            typeof deck.topSurfaceElevationMm === 'number' && Number.isFinite(deck.topSurfaceElevationMm)
              ? Math.round(deck.topSurfaceElevationMm)
              : resolveOptionalMillimetres(deck.levelOffsetMm) ?? 0,
          hostEdgeId: deck.hostEdgeId ?? null,
          isAttached: Boolean(deck.isAttached),
          surfaceMaterial:
            deck.surfaceMaterial === 'composite' || deck.surfaceMaterial === 'concrete'
              ? deck.surfaceMaterial
              : 'timber_decking',
          supportContext: deck.supportContext
            ? {
                classification:
                  deck.supportContext.classification === 'threshold_attached'
                    ? 'threshold_attached'
                    : deck.supportContext.classification === 'ground_supported'
                      ? 'ground_supported'
                      : 'mixed_or_unclear',
                nearestHouseEdgeId: deck.supportContext.nearestHouseEdgeId ?? null,
                nearestHouseEdgeDistanceMm: resolveOptionalMillimetres(
                  deck.supportContext.nearestHouseEdgeDistanceMm,
                ),
                attachmentContactLengthMm: resolveOptionalMillimetres(
                  deck.supportContext.attachmentContactLengthMm,
                ),
                warningCodes: deck.supportContext.warningCodes ?? [],
                warningMessages: deck.supportContext.warningMessages ?? [],
              }
            : null,
          validation: deck.validation
            ? {
                status: deck.validation.status === 'invalid' ? 'invalid' : 'valid',
                codes: deck.validation.codes ?? [],
                messages: deck.validation.messages ?? [],
              }
            : null,
        };
      })
      .filter((deck): deck is HouseDeckConfig => Boolean(deck));
  const openings: HouseOpeningConfig[] =
    (input.rawHouseContext.openings ?? [])
      .map((opening): HouseOpeningConfig | null => {
        if (!opening?.id) return null;
        const wallId =
          opening.wallId === 'front' ||
          opening.wallId === 'left' ||
          opening.wallId === 'right'
            ? opening.wallId
            : 'rear';
        const kind =
          opening.kind === 'hinged_door' ||
          opening.kind === 'slider' ||
          opening.kind === 'stacker' ||
          opening.kind === 'window'
            ? opening.kind
            : 'window';
        return {
          id: opening.id,
          label: opening.label?.trim() || null,
          kind,
          panelCount: resolveHouseOpeningPanelCount(kind, opening.panelCount),
          wallId,
          hostEdgeId: typeof opening.hostEdgeId === 'string' ? opening.hostEdgeId.trim() || null : null,
          widthMm: resolveOptionalMillimetres(opening.widthMm),
          heightMm: resolveOptionalMillimetres(opening.heightMm),
          sillHeightMm: resolveOptionalMillimetres(opening.sillHeightMm),
          offsetAlongWallMm: resolveOptionalMillimetres(opening.offsetAlongWallMm),
          validation: opening.validation
            ? {
                status: opening.validation.status === 'invalid' ? 'invalid' : 'valid',
                codes: opening.validation.codes ?? [],
                message: opening.validation.message ?? null,
              }
            : null,
        };
      })
      .filter((opening): opening is HouseOpeningConfig => Boolean(opening));

  return {
    footprint: input.footprint,
    storeyMode: resolveHouseStoreyMode(input.rawHouseContext.storeyMode),
    wallConstruction: resolveHouseWallConstruction(input.rawHouseContext.wallConstruction),
    roofForm,
    roofMaterial: resolveHouseRoofMaterial(input.rawHouseContext.roofMaterial),
    eaveHeightMm,
    wallHeightMm,
    roofPitchDeg,
    roofPrimaryFallDirection: resolveHouseRoofPrimaryFallDirection(
      input.rawHouseContext.roofPrimaryFallDirection,
    ),
    roofRidgeAxis: resolveHouseRoofRidgeAxis(input.rawHouseContext.roofRidgeAxis),
    openGableEndIds: (() => {
      // Migration: when raw `roofForm` was `'gable'`, the form now lives
      // as `'hipped'` with every terminal end open -- producing the
      // identical roof topology via the unified Dutch-hip pipeline. We
      // derive the full terminal-end set on demand from the resolved
      // footprint + ridge axis, then merge with any existing
      // `openGableEndIds` from storage so stored frame-tagging metadata
      // is preserved.
      const stored = resolveHouseOpenGableEndIds(input.rawHouseContext.openGableEndIds);
      if (rawRoofForm !== 'gable' || !input.footprint) return stored;
      const ridgeAxis = resolveHouseRoofRidgeAxis(input.rawHouseContext.roofRidgeAxis);
      const xTerminals = deriveHouseGableTerminalEndsFromFootprint({
        footprint: input.footprint,
        ridgeAxis: 'x',
      });
      const yTerminals = deriveHouseGableTerminalEndsFromFootprint({
        footprint: input.footprint,
        ridgeAxis: 'y',
      });
      // Prefer the active ridge axis's terminals, falling back to the
      // other axis's set if the active one is empty (defensive). Then
      // union with stored ids so any orientation-flipped saved data
      // doesn't drop entries.
      const activeTerminals = ridgeAxis === 'x' ? xTerminals : yTerminals;
      const fallbackTerminals = ridgeAxis === 'x' ? yTerminals : xTerminals;
      const terminals = activeTerminals.length > 0 ? activeTerminals : fallbackTerminals;
      const merged = new Set<string>(stored);
      for (const t of terminals) merged.add(t.id);
      return [...merged];
    })(),
    roofAppendage: input.rawHouseContext.roofAppendage
      ? {
          enabled: Boolean(input.rawHouseContext.roofAppendage.enabled),
          form: resolveHouseRoofAppendageForm(input.rawHouseContext.roofAppendage.form),
          hostEdge: input.rawHouseContext.roofAppendage.hostEdge ?? 'rear',
          pitchDeg: resolveOptionalDegrees(input.rawHouseContext.roofAppendage.pitchDeg),
          dropMm: resolveOptionalMillimetres(input.rawHouseContext.roofAppendage.dropMm),
        }
      : null,
    decks,
    openings,
    attachmentStrategy: resolveHouseAttachmentStrategy(input.rawHouseContext.attachmentStrategy, input.connectionType),
    eave: {
      soffitDepthMm: resolveMillimetresWithDefault(rawEave?.soffitDepthMm, DEFAULT_HOUSE_SOFFIT_DEPTH_MM),
      fasciaHeightMm: resolveMillimetresWithDefault(rawEave?.fasciaHeightMm, DEFAULT_HOUSE_FASCIA_HEIGHT_MM),
      gutterWidthMm: resolveMillimetresWithDefault(rawEave?.gutterWidthMm, DEFAULT_HOUSE_GUTTER_WIDTH_MM),
      gutterDepthMm: resolveMillimetresWithDefault(rawEave?.gutterDepthMm, DEFAULT_HOUSE_GUTTER_DEPTH_MM),
      gutterProjectionMm: resolveMillimetresWithDefault(rawEave?.gutterProjectionMm, DEFAULT_HOUSE_GUTTER_PROJECTION_MM),
      eaveOverhangMm: resolveMillimetresWithDefault(rawEave?.eaveOverhangMm, DEFAULT_HOUSE_EAVE_OVERHANG_MM),
    },
  };
}

export function normalizeGeometryConfig(input: RawGeometryModuleInput): NormalizeGeometryConfigResult {
  const family = resolveFamily(input);
  if (!family) {
    return fail('unsupported_family', `Pergola style ${input.pergolaStyle} is not supported by Sanctuary geometry V1.`);
  }

  const length = resolveDimensionMm({
    label: 'length',
    derivedValue: input.derived?.lengthM,
    rawValue: input.dimensions.lengthM,
  });
  if (!length.ok) return fail(length.code, length.error);

  const projection = resolveDimensionMm({
    label: 'projection',
    derivedValue: input.derived?.projectionM,
    rawValue: input.dimensions.projectionM,
  });
  if (!projection.ok) return fail(projection.code, projection.error);

  let hipCornerLengthB: { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } | null = null;
  let hipCornerProjectionB: { ok: true; value: number } | { ok: false; code: NormalizeGeometryConfigErrorCode; error: string } | null = null;
  if (family === 'hip_corner') {
    hipCornerLengthB = resolveDimensionMm({
      label: 'length B',
      rawValue: input.dimensions.hipCornerLengthBM,
    });
    if (!hipCornerLengthB.ok) return fail(hipCornerLengthB.code, hipCornerLengthB.error);

    hipCornerProjectionB = resolveDimensionMm({
      label: 'projection B',
      rawValue: input.dimensions.hipCornerProjectionBM,
    });
    if (!hipCornerProjectionB.ok) return fail(hipCornerProjectionB.code, hipCornerProjectionB.error);
  }

  const pitch = resolvePitchDeg(input);
  if (!pitch.ok) return fail(pitch.code, pitch.error);

  const overhang = resolveOverhangMm(input);
  if (!overhang.ok) return fail(overhang.code, overhang.error);

  const attachmentSide = resolveAttachmentSide(input.connection.attachmentSide);
  const connectionType = resolveConnectionType(input.connection.houseConnectionType);
  const roof = resolveRoofMaterial(input);
  const fallDirection = resolveFallDirection(input, family);
  const houseUndersideMm = resolveStructuralHeightMm(input.structural?.heights?.houseUndersideM);
  const outerUndersideMm = resolveStructuralHeightMm(input.structural?.heights?.outerUndersideM);
  const referenceUndersideMm = resolveStructuralHeightMm(input.structural?.heights?.referenceUndersideM);
  const gableEndFramesMode = resolveGableEndFramesMode(input.gable?.endFramesMode);
  const gableHouseEaveGutterMode =
    resolveGableEaveGutterMode(input.gable?.houseEaveGutter) ??
    (connectionType === 'freestanding' ? 'our' : 'house');
  const gableOuterEaveGutterMode = resolveGableEaveGutterMode(input.gable?.outerEaveGutter) ?? 'our';
  const boxHouseEdgeGutterMode =
    resolveBoxGutterMode(input.box?.houseEdgeGutter) ??
    (connectionType === 'freestanding' ? 'none' : 'house');
  const boxFarEdgeGutterMode =
    resolveBoxGutterMode(input.box?.farEdgeGutter) ??
    (connectionType === 'freestanding' ? 'none' : 'our');
  const boxEffectiveRunMm = resolveOptionalMetresToMillimetres(input.derived?.boxEffectiveRunM);
  const boxRiseMm = resolveOptionalMillimetres(input.derived?.boxRiseMm);
  const boxMaxFallMm = resolveOptionalMillimetres(input.derived?.boxMaxFallMm);
  const roofCoveringKind =
    (family === 'mono' || family === 'gable' || family === 'hip') && roof.material === 'acrylic' ? 'acrylic' : null;
  const footprintMode = resolveFootprintMode(input.houseContext.footprintMode);
  // Resolve the house's first-class spatial position. When set (post-migration
  // or after a house edge-drag), the custom polygon decodes against a unit
  // (1m × 1m) frame so the footprint is invariant to the pergola's dimensions.
  // The world translation is applied at the boundary by `applyAssemblyPosition3D`
  // (milestone 12) — every coord on `assembly.house` is house-local until
  // then. When null (legacy data, no edits yet), fall back to the
  // pergola-anchored real frame and pre-translate; `assembly.house.position`
  // stays null and `applyAssemblyPosition3D` skips the house transform.
  const housePosition = resolveOptionalAssemblyPosition(input.houseContext.position);
  let houseFootprint: GeometryConfig['houseContext']['footprint'] = null;
  if (connectionType !== 'freestanding') {
    if (footprintMode === 'custom_polygon') {
      const useUnitFrame = housePosition !== null;
      const customFootprint = buildCustomHouseFootprintPolygon({
        // Unit frame removes the pergola-dim dependency from the spatial
        // transform; the position field absorbs the offset.
        pergolaWidthMm: useUnitFrame ? 1000 : length.value,
        pergolaDepthMm: useUnitFrame ? 1000 : projection.value,
        polygon: input.houseContext.footprintPolygon,
        params: input.houseContext.footprintParams,
        attachmentSide,
      });
      if (!customFootprint.ok) {
        return fail('invalid_numeric_input', customFootprint.error);
      }
      // House-local coords when `useUnitFrame` (position routes through the
      // boundary); pergola-anchored real coords when not (legacy path).
      houseFootprint = customFootprint.polygon;
    } else {
      // Preset polygons remain pergola-coupled until the user edits a wall
      // (which converts to `custom_polygon` mode and triggers migration via
      // `commitSharedHouseFootprintEdit`).
      houseFootprint = buildHouseFootprintPolygon({
        pergolaWidthMm: length.value,
        pergolaDepthMm: projection.value,
        preset: resolveFootprintPreset(input.houseContext.footprintPreset),
        params: input.houseContext.footprintParams,
        attachmentSide,
      });
    }
  }
  const houseAttachmentStrategy =
    connectionType === 'freestanding'
      ? 'none'
      : resolveHouseAttachmentStrategy(input.houseContext.attachmentStrategy, connectionType);
  const houseModel = buildHouseModelConfig({
    rawHouseContext: input.houseContext,
    footprint: houseFootprint,
    connectionType,
    attachmentSide,
    houseUndersideMm,
    referenceUndersideMm,
  });

  if (
    family === 'gable' &&
    houseUndersideMm !== null &&
    outerUndersideMm !== null &&
    houseUndersideMm !== outerUndersideMm
  ) {
    return fail('unsupported_variant', 'Gable solver currently requires symmetrical eave underside heights.');
  }

  const datum = makeDatumFrame(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  );

  const position = resolveOptionalAssemblyPosition(input.position);

  return ok({
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    family,
    datum: {
      ...datum,
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: length.value, y: 0, z: 0 },
    },
    position,
    dimensions: {
      lengthMm: length.value,
      projectionMm: projection.value,
      lengthBMm: family === 'hip_corner' ? hipCornerLengthB?.value ?? null : null,
      projectionBMm: family === 'hip_corner' ? hipCornerProjectionB?.value ?? null : null,
      roofPitchDeg: pitch.value,
    },
    roof: {
      material: roof.material,
      mode: roof.mode ?? null,
      fallDirection,
      boxPerimeterEnabled: input.boxPerimeterEnabled,
      overhangMm: overhang.value,
    },
    roofCovering: {
      kind: roofCoveringKind,
      effectiveRunMm: roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.effectiveRunM) : null,
      acrylicRequiredDownslopeMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.acrylicRequiredDownslopeM) : null,
      joinerPieceLengthMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.joinerPieceLengthM) : null,
      joinerRunsTotal:
        roofCoveringKind === 'acrylic' ? parseNonNegativeInteger(input.derived?.joinerRunsTotal) : null,
      houseAllowanceMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.rafterHouseAllowanceM) : null,
      farAllowanceMm:
        roofCoveringKind === 'acrylic' ? resolveOptionalMetresToMillimetres(input.derived?.rafterFarAllowanceM) : null,
      acrylicAreaMm2:
        roofCoveringKind === 'acrylic' ? resolveOptionalSquareMetresToSquareMillimetres(input.derived?.acrylicAreaM2) : null,
      mixedAcrylicBaysMain: resolveOptionalCount(input.roof.mixedAcrylicBaysMain),
      mixedAcrylicBaysA: resolveOptionalCount(input.roof.mixedAcrylicBaysA),
      mixedAcrylicBaysB: resolveOptionalCount(input.roof.mixedAcrylicBaysB),
    },
    gable: {
      ridgePositionMm: family === 'gable' || family === 'hip' ? projection.value / 2 : null,
      endFramesMode: family === 'gable' || family === 'hip' ? gableEndFramesMode ?? 'none' : null,
      houseEaveGutterMode: family === 'gable' || family === 'hip' ? gableHouseEaveGutterMode : null,
      outerEaveGutterMode: family === 'gable' || family === 'hip' ? gableOuterEaveGutterMode : null,
    },
    box: {
      houseEdgeGutterMode: family === 'box' ? boxHouseEdgeGutterMode : null,
      farEdgeGutterMode: family === 'box' ? boxFarEdgeGutterMode : null,
      houseSetbackMm: family === 'box' ? BOX_HOUSE_SETBACK_MM : null,
      outerSetbackMm: family === 'box' ? BOX_OUTER_SETBACK_MM : null,
      effectiveRunMm: family === 'box' ? boxEffectiveRunMm : null,
      riseMm: family === 'box' ? boxRiseMm : null,
      maxFallMm: family === 'box' ? boxMaxFallMm : null,
    },
    connection: {
      type: connectionType,
      attachmentSide,
    },
    supports: {
      postMode: input.supports.postMode ?? (input.supports.postPositions?.length ? 'custom' : 'standard'),
      postPositions: input.supports.postPositions ?? undefined,
      postCount: parseNonNegativeInteger(input.supports.postCount) ?? undefined,
      postCutHeightMm: resolvePostCutHeightMm(input.supports.postCutHeightM),
      footingType: resolveFootingType(input.supports.postConnectionType),
      postConnectionType: input.supports.postConnectionType ?? null,
      groundCondition: input.supports.ground ?? null,
      groundLevelMm: null,
    },
    structural: {
      heights: {
        houseUndersideMm,
        outerUndersideMm,
        referenceUndersideMm,
      },
      profiles: {
        post: resolveStructuralProfile(input.structural?.profiles?.post),
        rafter: resolveStructuralProfile(input.structural?.profiles?.rafter),
        ledger: resolveStructuralProfile(input.structural?.profiles?.ledger),
        supportBeam: resolveStructuralProfile(input.structural?.profiles?.supportBeam),
        gutter: resolveStructuralProfile(input.structural?.profiles?.gutter),
        ridge: resolveStructuralProfile(input.structural?.profiles?.ridge),
        tieBeam: resolveStructuralProfile(input.structural?.profiles?.tieBeam),
        strut: resolveStructuralProfile(input.structural?.profiles?.strut),
        boxPerimeter: resolveStructuralProfile(input.structural?.profiles?.boxPerimeter),
      },
      framing: {
        rafterCount: resolveRafterCount(input.structural?.framing?.rafterCount),
        rafterSpacingMm: resolveRafterSpacingMm(input.structural?.framing?.rafterSpacingMm),
      },
      drainage: {
        gutterType: input.structural?.drainage?.gutterType ?? null,
        gutterAssemblyMode: resolveGutterAssemblyMode(input.structural?.drainage?.gutterAssemblyMode),
        integratedGutterBeam: input.structural?.drainage?.integratedGutterBeam ?? null,
        hasOurGutter: input.structural?.drainage?.hasOurGutter ?? null,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: null,
      footprint: houseFootprint,
      footprintMode: connectionType === 'freestanding' ? 'preset' : footprintMode,
      footprintPolygon: footprintMode === 'custom_polygon' ? input.houseContext.footprintPolygon ?? null : null,
      position: housePosition,
      model: houseModel,
      attachmentStrategy: houseAttachmentStrategy,
    },
  });
}
