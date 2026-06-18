import {
  type BoxGutterEdge,
  type CostInputsV1,
  type DerivedV1,
  type FlashingBandOrNoneV1,
  type FlashingBandV1,
  type FlashingDefaultNormalizedV1,
  type FlashingNormalizedV1,
  type GableEndFramesMode,
  type GutterAssemblyMode,
  type GutterMode,
  type GroundCondition,
  type InputsNormalizedV1,
  type MixedRoofMode,
  type MixedRoofNormalizedV1,
  type OverhangSupportBeamProfile,
  type PergolaStyleUi,
  type RafterProfile,
  type RoofType,
  type SlopeDirection,
  type StructureType,
} from './types';
import type { CostingConfigV1 } from './config';

const GST_RATE = 0.15;
const DEFAULT_POST_CUT_HEIGHT_M = 2.4;
const DEFAULT_POST_COUNT = 4;
const DEFAULT_GROUND: GroundCondition = 'easy';
const DEFAULT_ROOF_TYPE: RoofType = 'pitched';
const DEFAULT_MIXED_MODE: MixedRoofMode = 'ridge_skylight';

const RAFTER_SPACING_MM_MAX = 642;
const RAFTER_THICKNESS_MM = 50;
const TIMBER_RAFTER_SPACING_MM_MAX = 500;
const TIMBER_EDGE_RAFTER_PROFILE = '150x50';
const TIMBER_COMMON_RAFTER_DEFAULT_PROFILE = '80x50';
const TIMBER_PURLIN_PROFILE = '50x50';
const BRACKET_SPACING_MM_MAX = 1500;
const STRINGER_FIXING_SPACING_MM = 1500;

const RAFTER_HOUSE_SETBACK_M = 0.05;
const RAFTER_GUTTER_SETBACK_M = 0.1;
const JOINER_EXTRA_M = 0.02;

const DEFAULT_ACRYLIC_SHEET_LENGTH_M = 3.05;
const DEFAULT_ACRYLIC_SHEET_WIDTH_M = 2.03;
const MIXED_ACRYLIC_BAY_WIDTH_M = 0.62;
const DEFAULT_MIXED_ACRYLIC_BAYS = 2;
const FLASHING_EDGE_ALLOWANCE_M = 0.1;
const FLASHING_BAND_0_200: FlashingBandV1 = '0-200';
const FLASHING_BAND_201_300: FlashingBandV1 = '201-300';
const FLASHING_BAND_301_400: FlashingBandV1 = '301-400';
const FLASHING_BANDS: readonly FlashingBandV1[] = [FLASHING_BAND_0_200, FLASHING_BAND_201_300, FLASHING_BAND_301_400];

type DerivedResultV1 = {
  inputs_normalized: InputsNormalizedV1;
  derived: DerivedV1 & {
    box_corner_count?: number;
  };
  notes_and_warnings: string[];
};

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function roundNumber(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toNonNegativeNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeFlashingBand(value: unknown): FlashingBandV1 {
  if (value === FLASHING_BAND_201_300) return FLASHING_BAND_201_300;
  if (value === FLASHING_BAND_301_400) return FLASHING_BAND_301_400;
  return FLASHING_BAND_0_200;
}

function normalizeFlashingBandOrNone(value: unknown): FlashingBandOrNoneV1 {
  if (value === 'none') return 'none';
  return normalizeFlashingBand(value);
}

function normalizePergolaStyle(style: PergolaStyleUi): { style: PergolaStyleUi; warnings: string[] } {
  return { style, warnings: [] };
}

function pickStructureType(style: PergolaStyleUi, boxEnabled: boolean | undefined): StructureType {
  if (style === 'box_perimeter') return 'box_perimeter';
  return boxEnabled ? 'box_perimeter' : 'pitched';
}

function pickRoofType(style: PergolaStyleUi, structureType: StructureType, roofType: RoofType | undefined): RoofType {
  if (structureType === 'box_perimeter' && roofType) return roofType;
  if (style === 'gable') return 'gable';
  if (style === 'hip') return 'hip';
  if (style === 'hip_corner') return 'hip_corner';
  return 'pitched';
}

function pickRafterProfile(projectionM: number): { profile: RafterProfile; warnings: string[] } {
  if (projectionM <= 2) {
    return {
      profile: '80x50',
      warnings: [],
    };
  }
  if (projectionM <= 4) return { profile: '100x50', warnings: [] };
  return { profile: '150x50', warnings: [] };
}

function normalizeOverrideProfile(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeProfileLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, 'x');
}

function isSteelBeamProfile(value: string | null | undefined): boolean {
  const normalized = normalizeProfileLabel(value);
  return normalized === 'rhs150x50x3' || normalized === 'rhs150x50x3mm';
}

function isGutterBeamProfile(profile: string | null | undefined): boolean {
  if (!profile) return false;
  const normalized = profile.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('spgutter');
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function cosDeg(deg: number): number {
  return Math.cos(degToRad(deg));
}

function tanDeg(deg: number): number {
  return Math.tan(degToRad(deg));
}

function rafterDepthM(profile: string): number {
  const raw = String(profile ?? '').trim();
  const match = raw.match(/(\d+(?:\.\d+)?)\s*x/i);
  if (match) {
    const depthMm = Number.parseFloat(match[1] ?? '');
    if (Number.isFinite(depthMm) && depthMm > 0) return depthMm / 1000;
  }
  if (raw === '80x50') return 0.08;
  if (raw === '100x50') return 0.1;
  if (raw === '150x50') return 0.15;
  return 0.1;
}

function profileWidthM(profile: string): number {
  const raw = String(profile ?? '').trim();
  const match = raw.match(/x\s*(\d+(?:\.\d+)?)/i);
  if (match) {
    const widthMm = Number.parseFloat(match[1] ?? '');
    if (Number.isFinite(widthMm) && widthMm > 0) return widthMm / 1000;
  }
  return 0.05;
}

function oneSizeUpProfile(profile: string): string {
  const raw = String(profile ?? '').trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  if (normalized === '80x50') return '100x50';
  if (normalized === '100x50') return '150x50';
  return raw || profile;
}

function normalizeMixedRoof(
  inputs: CostInputsV1,
  opts: {
    lengthM: number;
    roofSurfaceAreaM2: number;
    roofPlanes: Array<{ id: string; label: string; bay_count: number; rafter_length_m: number; roof_area_m2: number }>;
    config?: Pick<CostingConfigV1, 'rules'>;
  },
): {
  normalized: MixedRoofNormalizedV1;
  acrylicAreaM2: number;
  timberAreaM2: number;
  acrylicBaysTotal: number | null;
  acrylicPlaneCountUsed: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  const rulesDefaults = (opts.config?.rules as any)?.defaults as any;
  const defaultModeRaw = String(rulesDefaults?.default_mixed_mode ?? DEFAULT_MIXED_MODE);
  const mode: MixedRoofMode =
    defaultModeRaw === 'area_override' ? 'area_override' : defaultModeRaw === 'acrylic_bays' ? 'acrylic_bays' : 'ridge_skylight';

  const requestedModeRaw = String(inputs.mixed_roof?.mode ?? mode);
  const hasAcrylicBaysByPlane = Boolean(inputs.mixed_roof?.acrylic_bays_by_plane && typeof inputs.mixed_roof?.acrylic_bays_by_plane === 'object');
  const requestedMode: MixedRoofMode =
    requestedModeRaw === 'area_override'
      ? 'area_override'
      : requestedModeRaw === 'acrylic_bays' || hasAcrylicBaysByPlane
        ? 'acrylic_bays'
        : 'ridge_skylight';

  if (requestedMode === 'acrylic_bays') {
    const raw = inputs.mixed_roof?.acrylic_bays_by_plane;
    const byPlane = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const defaultBays = Math.max(0, Math.round(DEFAULT_MIXED_ACRYLIC_BAYS));

    let acrylicAreaM2 = 0;
    let acrylicBaysTotal = 0;
    let acrylicPlaneCountUsed = 0;

    const clampedByPlane: Record<string, number> = {};

    for (const plane of opts.roofPlanes) {
      const rawValue = byPlane[plane.id];
      const hasRaw = rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '';
      const parsed = hasRaw
        ? typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string'
            ? Number.parseInt(rawValue, 10)
            : NaN
        : NaN;
      const requested = Number.isFinite(parsed) ? Math.round(parsed) : defaultBays;
      const clamped = Math.max(0, Math.min(plane.bay_count, requested));
      clampedByPlane[plane.id] = clamped;

      if (Number.isFinite(parsed) && requested > plane.bay_count) {
        warnings.push(`Mixed roof acrylic bays exceed bay count for ${plane.label}; clamping to ${plane.bay_count}.`);
      }

      if (Number.isFinite(plane.rafter_length_m) && plane.rafter_length_m > 6 + 1e-6 && clamped > 0) {
        warnings.push('Acrylic slope exceeds 6.0m max.');
      }

      const acrylicAreaPlane = clamped * MIXED_ACRYLIC_BAY_WIDTH_M * Math.max(0, plane.rafter_length_m);
      acrylicAreaM2 += acrylicAreaPlane;
      acrylicBaysTotal += clamped;
      if (clamped > 0) acrylicPlaneCountUsed += 1;
    }

    const totalRoofAreaM2 = Math.max(0, opts.roofSurfaceAreaM2);
    let acrylicAreaClamped = acrylicAreaM2;
    if (!Number.isFinite(acrylicAreaClamped) || acrylicAreaClamped < 0) {
      warnings.push('Mixed roof acrylic area was negative; clamping to 0.');
      acrylicAreaClamped = 0;
    }
    if (acrylicAreaClamped > totalRoofAreaM2 + 1e-6) {
      warnings.push('Mixed roof acrylic area exceeds roof area; clamping to roof area.');
      acrylicAreaClamped = totalRoofAreaM2;
    }
    const timberAreaM2 = Math.max(0, totalRoofAreaM2 - acrylicAreaClamped);

    return {
      normalized: {
        mode: 'acrylic_bays',
        ridge_skylight: null,
        acrylic_area_m2_override: null,
        acrylic_bays_by_plane: clampedByPlane,
      },
      acrylicAreaM2: acrylicAreaClamped,
      timberAreaM2,
      acrylicBaysTotal,
      acrylicPlaneCountUsed,
      warnings,
    };
  }

  if (requestedMode === 'area_override') {
    const override = toNonNegativeNumber(inputs.mixed_roof?.acrylic_area_m2, 0);
    if (!override) warnings.push('Mixed roof mode is area override but acrylic area is 0; no acrylic will be costed.');

    const clamped = Math.min(override, opts.roofSurfaceAreaM2);
    if (override > opts.roofSurfaceAreaM2 + 1e-6) warnings.push('Mixed roof acrylic area exceeds roof area; clamping to roof area.');
    if (clamped < 0) warnings.push('Mixed roof acrylic area was negative; clamping to 0.');

    return {
      normalized: {
        mode: 'area_override',
        ridge_skylight: null,
        acrylic_area_m2_override: override,
        acrylic_bays_by_plane: null,
      },
      acrylicAreaM2: Math.max(0, clamped),
      timberAreaM2: Math.max(0, opts.roofSurfaceAreaM2 - Math.max(0, clamped)),
      acrylicBaysTotal: null,
      acrylicPlaneCountUsed: 0,
      warnings,
    };
  }

  const defaultStripWidth = Number(rulesDefaults?.default_ridge_skylight_strip_width_m ?? 0.62);
  const stripWidth = toPositiveNumber(inputs.mixed_roof?.ridge_skylight?.strip_width_m, defaultStripWidth);

  const defaultStripCount = Number(rulesDefaults?.default_ridge_skylight_strip_count ?? 1);
  const stripCountRaw = typeof inputs.mixed_roof?.ridge_skylight?.strip_count === 'number'
    ? inputs.mixed_roof?.ridge_skylight?.strip_count
    : Number.parseInt(String(inputs.mixed_roof?.ridge_skylight?.strip_count ?? ''), 10);
  const stripCount = Number.isFinite(stripCountRaw) && stripCountRaw > 0 ? Math.round(stripCountRaw) : Math.max(1, Math.round(defaultStripCount || 1));

  const acrylicArea = stripCount * stripWidth * opts.lengthM;
  const clamped = Math.min(acrylicArea, opts.roofSurfaceAreaM2);
  if (acrylicArea > opts.roofSurfaceAreaM2 + 1e-6) warnings.push('Mixed roof skylight area exceeds roof area; clamping to roof area.');
  if (clamped < 0) warnings.push('Mixed roof acrylic area was negative; clamping to 0.');

  return {
    normalized: {
      mode: 'ridge_skylight',
      ridge_skylight: {
        strip_count: stripCount,
        strip_width_m: stripWidth,
      },
      acrylic_area_m2_override: null,
      acrylic_bays_by_plane: null,
    },
    acrylicAreaM2: Math.max(0, clamped),
    timberAreaM2: Math.max(0, opts.roofSurfaceAreaM2 - Math.max(0, clamped)),
    acrylicBaysTotal: null,
    acrylicPlaneCountUsed: 0,
    warnings,
  };
}

export function normalizeAndDeriveV1(inputs: CostInputsV1, config?: Pick<CostingConfigV1, 'rules'>): DerivedResultV1 {
  const warnings: string[] = [];

  const lengthM = toPositiveNumber(inputs.length_m, 1);
  const roofSpanFromRoofSpanM = toPositiveNumber((inputs as any).roof_span_m, NaN);
  const roofSpanFromProjectionM = toPositiveNumber((inputs as any).projection_m, NaN);
  const roofSpanM = Number.isFinite(roofSpanFromRoofSpanM)
    ? roofSpanFromRoofSpanM
    : Number.isFinite(roofSpanFromProjectionM)
      ? roofSpanFromProjectionM
      : 1;

  if (
    Number.isFinite(roofSpanFromRoofSpanM) &&
    Number.isFinite(roofSpanFromProjectionM) &&
    Math.abs(roofSpanFromRoofSpanM - roofSpanFromProjectionM) > 1e-6
  ) {
    warnings.push('Both roof_span_m and projection_m were provided with different values; using roof_span_m.');
  }

  const projectionM = roofSpanM;
  const postCutHeightM = toPositiveNumber(inputs.post_cut_height_m, DEFAULT_POST_CUT_HEIGHT_M);
  const roofPitchDegRaw = typeof inputs.roof_pitch_deg === 'number' ? inputs.roof_pitch_deg : Number.parseFloat(String(inputs.roof_pitch_deg ?? ''));
  const roofPitchDeg = Number.isFinite(roofPitchDegRaw) ? clamp(roofPitchDegRaw, 0, 85) : null;

  const postCountRaw = typeof inputs.post_count === 'number' ? inputs.post_count : Number.parseInt(String(inputs.post_count ?? ''), 10);
  const postCount = Number.isFinite(postCountRaw) && postCountRaw > 0 ? Math.round(postCountRaw) : DEFAULT_POST_COUNT;
  // PR-F (2026-05-22): replaces legacy `attachment_side` enum. The cost
  // engine only needed the attachment edge LENGTH (for bracket-count
  // calculations); the cardinal-side concept was a clumsy 2-bit proxy
  // for "is the long or short side attached". When callers don't supply
  // `attachment_length_mm`, default to `length_m * 1000` — equivalent
  // to the legacy `attachment_side: 'rear'` / `'front'` behavior the
  // marketing-form enquiry path always used.
  const attachmentLengthMmRaw =
    typeof inputs.attachment_length_mm === 'number' ? inputs.attachment_length_mm : null;
  const attachmentLengthMmInput =
    attachmentLengthMmRaw !== null && Number.isFinite(attachmentLengthMmRaw) && attachmentLengthMmRaw > 0
      ? attachmentLengthMmRaw
      : null;

  const styleNormalized = normalizePergolaStyle(inputs.pergola_style);
  warnings.push(...styleNormalized.warnings);

  const structureType = pickStructureType(styleNormalized.style, inputs.box_perimeter_enabled);
  const roofType = pickRoofType(styleNormalized.style, structureType, inputs.internal_roof_type);
  const isBoxPerimeter = structureType === 'box_perimeter';

  const defaultGableEndFramesMode: GableEndFramesMode =
    inputs.house_connection_type !== 'none' ? 'outer_end_only' : 'both_ends';
  const gableEndFramesModeRaw = String((inputs as any).gable_end_frames_mode ?? '').trim();
  const gableEndFramesMode: GableEndFramesMode =
    gableEndFramesModeRaw === 'none' || gableEndFramesModeRaw === 'outer_end_only' || gableEndFramesModeRaw === 'both_ends'
      ? (gableEndFramesModeRaw as GableEndFramesMode)
      : defaultGableEndFramesMode;

  const fallDistanceMmRaw =
    typeof inputs.fall_distance_mm === 'number' ? inputs.fall_distance_mm : Number.parseFloat(String(inputs.fall_distance_mm ?? ''));
  const fallDistanceMm =
    structureType === 'box_perimeter' ? (Number.isFinite(fallDistanceMmRaw) && fallDistanceMmRaw > 0 ? fallDistanceMmRaw : 0) : null;

  const overhangRules = (config?.rules as any)?.geometry?.overhang as any;
  const overhangDefaultM = Number(overhangRules?.default_amount_m ?? 0.2);
  const overhangMinM = Number(overhangRules?.min_amount_m ?? 0);
  const overhangMaxM = Number(overhangRules?.max_amount_m ?? 1.5);

  const overhangEnabledRaw = inputs.overhang_enabled === true;
  const invertedEnabledRaw = inputs.inverted_enabled === true;
  const overhangEnabled = overhangEnabledRaw && !isBoxPerimeter;
  const invertedEnabled = invertedEnabledRaw && roofType === 'pitched';

  if (overhangEnabledRaw && isBoxPerimeter) {
    warnings.push('INVALID: Overhang cannot be used with Box Perimeter.');
  }
  if (invertedEnabledRaw && roofType !== 'pitched') {
    warnings.push('INVALID: Inverted option is only available for Pitched roofs.');
  }

  const ground: GroundCondition = inputs.ground ?? DEFAULT_GROUND;

  const hipCornerLengthBM = toNonNegativeNumber(inputs.hip_corner?.length_b_m, 0);
  const hipCornerProjectionBM = toNonNegativeNumber(inputs.hip_corner?.projection_b_m, 0);

  if (roofType === 'hip_corner') {
    if (hipCornerLengthBM <= 0) warnings.push('Hip corner: wing B length is required and currently set to 0.');
    if (hipCornerProjectionBM <= 0) warnings.push('Hip corner: wing B projection is required and currently set to 0.');
    warnings.push('Hip corner is approximated as two pitched wings meeting at a corner (v1).');
  }

  const effectiveSpanM =
    roofType === 'hip_corner' ? Math.max(projectionM, hipCornerProjectionBM) : roofType === 'pitched' ? projectionM : projectionM / 2;
  const overrides = (inputs as any).overrides ?? {};
  const { profile: rafterProfileAutoBase, warnings: profileWarnings } =
    structureType === 'box_perimeter' ? { profile: '80x50' as const, warnings: [] } : pickRafterProfile(effectiveSpanM);
  warnings.push(...profileWarnings);

  const overrideRafterProfile = normalizeOverrideProfile(overrides.rafter_profile);
  const rafterProfileAuto = inputs.roof_material === 'timber' ? TIMBER_COMMON_RAFTER_DEFAULT_PROFILE : rafterProfileAutoBase;
  const rafterProfile = overrideRafterProfile ?? rafterProfileAuto;

  const overrideLedgerProfile = normalizeOverrideProfile(overrides.ledger_profile);
  const overridePostProfile = normalizeOverrideProfile(overrides.post_profile);
  const overrideFrontBeamProfile = normalizeOverrideProfile(overrides.front_beam_profile);
  const overrideRidgeBeamProfile = normalizeOverrideProfile(overrides.ridge_beam_profile);
  const overrideBoxPerimeterBeamProfile = normalizeOverrideProfile(overrides.box_perimeter_beam_profile);
  const overrideOverhangSupportBeamProfile = normalizeOverrideProfile(overrides.overhang_support_beam_profile);
  const overrideTieBeamProfile = normalizeOverrideProfile(overrides.tie_beam_profile);
  const overrideStrutProfile = normalizeOverrideProfile(overrides.strut_profile);

  const overhangAmountRaw = toNonNegativeNumber((inputs as any).overhang_amount_m, NaN);
  let overhangAmountM = overhangEnabled
    ? Number.isFinite(overhangAmountRaw)
      ? overhangAmountRaw
      : overhangDefaultM
    : 0;
  overhangAmountM = clampNumber(overhangAmountM, overhangMinM, overhangMaxM);
  if (
    overhangEnabled &&
    Number.isFinite(overhangAmountRaw) &&
    (overhangAmountRaw < overhangMinM - 1e-6 || overhangAmountRaw > overhangMaxM + 1e-6)
  ) {
    warnings.push(
      `Overhang amount clamped to ${roundNumber(overhangAmountM, 2)}m (allowed ${roundNumber(overhangMinM, 2)}–${roundNumber(
        overhangMaxM,
        2,
      )}m).`,
    );
  }

  if (overhangEnabled && overhangAmountM >= projectionM - 1e-6) {
    warnings.push(
      `INVALID: Overhang amount ${roundNumber(overhangAmountM, 2)}m must be less than roof span ${roundNumber(projectionM, 2)}m.`,
    );
  }

  const overhangSupportBeamProfileRaw = normalizeOverrideProfile(inputs.overhang_support_beam_profile);
  const overhangSupportBeamProfile: OverhangSupportBeamProfile | string | null = overhangEnabled
    ? overrideOverhangSupportBeamProfile ??
      (overhangSupportBeamProfileRaw === '200x50' ||
      overhangSupportBeamProfileRaw === '150x50' ||
      isSteelBeamProfile(overhangSupportBeamProfileRaw)
        ? overhangSupportBeamProfileRaw
        : '150x50')
    : null;

  const lengthMmA = Math.round(lengthM * 1000);
  const lengthMmB = Math.round(hipCornerLengthBM * 1000);

  const isAcrylicRoof = inputs.roof_material === 'acrylic';
  const calcRafterSpacing = (lengthMm: number) => {
    if (isAcrylicRoof) {
      const clearLenMm = Math.max(0, lengthMm - RAFTER_THICKNESS_MM);
      const bays = Math.max(1, Math.ceil(clearLenMm / RAFTER_SPACING_MM_MAX));
      return { rafterCount: bays + 1, bayCount: bays, clearLenMm };
    }
    const rafterCount = Math.ceil(lengthMm / RAFTER_SPACING_MM_MAX) + 1;
    return { rafterCount, bayCount: Math.max(0, rafterCount - 1), clearLenMm: lengthMm };
  };

  const rafterA = calcRafterSpacing(lengthMmA);
  const rafterCountA = rafterA.rafterCount;
  const bayCountA = rafterA.bayCount;

  const rafterB = roofType === 'hip_corner' && hipCornerLengthBM > 0 ? calcRafterSpacing(lengthMmB) : null;
  const rafterCountB = rafterB ? rafterB.rafterCount : 0;
  const bayCountB = roofType === 'hip_corner' ? (rafterB ? rafterB.bayCount : 0) : 0;

  // PR-F (2026-05-22): use caller-supplied `attachment_length_mm` when set,
  // otherwise default to `lengthMmA` (legacy `'rear'` / `'front'` behavior).
  const attachmentLengthMmA =
    roofType === 'hip_corner' ? lengthMmA : (attachmentLengthMmInput ?? lengthMmA);
  const bracketCountA = inputs.house_connection_type === 'soffit' ? Math.ceil(attachmentLengthMmA / BRACKET_SPACING_MM_MAX) + 1 : 0;
  const bracketCountB =
    roofType === 'hip_corner' && inputs.house_connection_type === 'soffit'
      ? hipCornerLengthBM > 0
        ? Math.ceil(lengthMmB / BRACKET_SPACING_MM_MAX) + 1
        : 0
      : 0;

  const stringerFixingCountA =
    inputs.house_connection_type === 'fascia' || inputs.house_connection_type === 'facade'
      ? Math.ceil(attachmentLengthMmA / STRINGER_FIXING_SPACING_MM) + 1
      : 0;
  const stringerFixingCountB =
    roofType === 'hip_corner' && (inputs.house_connection_type === 'fascia' || inputs.house_connection_type === 'facade')
      ? hipCornerLengthBM > 0
        ? Math.ceil(lengthMmB / STRINGER_FIXING_SPACING_MM) + 1
        : 0
      : 0;

  const rafterCount = roofType === 'hip_corner' ? rafterCountA + rafterCountB : rafterCountA;
  const bayCount = roofType === 'hip_corner' ? bayCountA + bayCountB : bayCountA;
  const bracketCount = roofType === 'hip_corner' ? bracketCountA + bracketCountB : bracketCountA;
  const stringerFixingCount =
    roofType === 'hip_corner' ? stringerFixingCountA + stringerFixingCountB : stringerFixingCountA;

  const areaM2 =
    roofType === 'hip_corner'
      ? lengthM * projectionM + hipCornerLengthBM * hipCornerProjectionBM
      : lengthM * projectionM;

  const pitchDefaults = (config?.rules as any)?.geometry?.roof_pitch_defaults_deg as Record<string, number> | undefined;
  const boxRules = (config?.rules as any)?.geometry?.box_perimeter as any;
  const boxBeamDepthMm = Number(boxRules?.box_beam_depth_mm ?? 300);
  const boxRafterDepthMm = Number(boxRules?.box_rafter_depth_mm ?? 80);
  const boxRoofAllowAboveRafterMm = Number(boxRules?.box_roof_allow_above_rafter_mm ?? 20);
  const boxMaxFallMm = Number(
    Number.isFinite(boxRules?.box_max_fall_mm)
      ? boxRules?.box_max_fall_mm
      : boxBeamDepthMm - (boxRafterDepthMm + boxRoofAllowAboveRafterMm),
  );
  const boxMinPitchDeg = Number(boxRules?.box_min_pitch_deg ?? 3);
  const pitchedSetbacksMm = boxRules?.pitched_setbacks ?? { house_setback_mm: 150, outer_setback_mm: 50 };
  const gableSetbacksMm = boxRules?.gable_setbacks ?? { eave_setback_mm: 50, ridge_allowance_mm: 0 };
  const defaultPitchRaw = Number(
    pitchDefaults?.[roofType] ??
      (roofType === 'low_gable' ? 10 : roofType === 'gable' || roofType === 'hip' || roofType === 'hip_corner' ? 25 : 5),
  );
  const defaultPitch = Number.isFinite(defaultPitchRaw) ? defaultPitchRaw : 5;
  const isBoxGable = isBoxPerimeter && (roofType === 'gable' || roofType === 'low_gable');
  const isBoxPitched = isBoxPerimeter && roofType === 'pitched';

  let boxEffectiveRunM: number | undefined = undefined;
  let boxPitchDegUsed: number | undefined = undefined;
  let boxRiseMm: number | undefined = undefined;
  let boxMaxSupportedRunMAtMinPitch: number | undefined = undefined;
  let boxMaxSupportedSpanM: number | undefined = undefined;

  if (isBoxPerimeter) {
    const projectionMm = projectionM * 1000;
    const houseSetbackMm = Number(pitchedSetbacksMm?.house_setback_mm ?? 150);
    const outerSetbackMm = Number(pitchedSetbacksMm?.outer_setback_mm ?? 50);
    const eaveSetbackMm = Number(gableSetbacksMm?.eave_setback_mm ?? 50);
    const ridgeAllowanceMm = Number(gableSetbacksMm?.ridge_allowance_mm ?? 0);

    const runMm = isBoxGable
      ? projectionMm / 2 - (eaveSetbackMm + ridgeAllowanceMm)
      : projectionMm - (houseSetbackMm + outerSetbackMm);
    const safeRunMm = Math.max(0, runMm);
    boxEffectiveRunM = safeRunMm / 1000;

    const minPitchRad = degToRad(Math.max(0.01, boxMinPitchDeg));
    const maxSupportedRunMmAtMinPitch = boxMaxFallMm / Math.tan(minPitchRad);
    boxMaxSupportedRunMAtMinPitch = maxSupportedRunMmAtMinPitch / 1000;
    const maxSupportedSpanMm = isBoxGable
      ? 2 * maxSupportedRunMmAtMinPitch + 2 * (eaveSetbackMm + ridgeAllowanceMm)
      : maxSupportedRunMmAtMinPitch + (houseSetbackMm + outerSetbackMm);
    boxMaxSupportedSpanM = maxSupportedSpanMm / 1000;

    const computedPitchRad = safeRunMm > 0 ? Math.atan(boxMaxFallMm / safeRunMm) : degToRad(85);
    const computedPitchDeg = (computedPitchRad * 180) / Math.PI;
    const clampedPitchDeg = clamp(computedPitchDeg, boxMinPitchDeg, 85);

    boxPitchDegUsed = clampedPitchDeg;
    boxRiseMm = Math.tan(degToRad(clampedPitchDeg)) * safeRunMm;

    if (computedPitchDeg < boxMinPitchDeg - 1e-6) {
      warnings.push(
        `INVALID: Box perimeter span too large. Even at max fall ${roundNumber(boxMaxFallMm)}mm, pitch would be ${roundNumber(
          computedPitchDeg,
        )}°, below minimum ${roundNumber(boxMinPitchDeg)}°. Reduce span or change style. (run ${roundNumber(
          safeRunMm,
        )}mm, max_supported_span ${roundNumber(maxSupportedSpanMm)}mm)`,
      );
    }

    const riseAtMinPitchMm = Math.tan(minPitchRad) * safeRunMm;
    if (riseAtMinPitchMm > boxMaxFallMm + 1e-6) {
      warnings.push(
        `INVALID: Box perimeter fall exceeds available depth. Required fall ${roundNumber(riseAtMinPitchMm)}mm exceeds max ${roundNumber(
          boxMaxFallMm,
        )}mm.`,
      );
    }
  }

  const roofPitchDegUsed = isBoxPerimeter ? boxPitchDegUsed ?? defaultPitch : roofPitchDeg ?? defaultPitch;

  const effectiveCos = Math.max(0.02, cosDeg(roofPitchDegUsed));
  if (effectiveCos <= 0.021) warnings.push('Roof pitch is very steep; clamping trig calculation for safety.');

  // Geometry semantics:
  // - `roofSpanM` (aka legacy `projection_m`) is the total eave-to-eave span.
  // - For gable/low_gable/hip, each roof plane span is half that (`roofSpanM / 2`).
  // - `cutRafterLengthM` is based on the effective run (house + gutter setbacks removed).
  // - `joinerPieceLengthM` and `acrylicRequiredDownslopeM` add the 20mm joiner allowance only.
  const rafterRunM =
    roofType === 'hip_corner' ? Math.max(projectionM, hipCornerProjectionBM) : roofType === 'pitched' ? projectionM : projectionM / 2;
  const roofSurfaceAreaM2 = areaM2 / effectiveCos;

  const timberRoofAboveTypeRaw = String(inputs.timber_roof_above_type ?? '');
  const timberRoofAboveType =
    timberRoofAboveTypeRaw === 'steel_corrugated' || timberRoofAboveTypeRaw === 'steel_tray' || timberRoofAboveTypeRaw === 'insulated_panels'
      ? timberRoofAboveTypeRaw
      : 'insulated_panels';
  const timberInsulatedPanelThicknessMm = Math.max(
    0,
    Math.round(toNonNegativeNumber(inputs.timber_insulated_panel_thickness_mm, 50)),
  );
  const timberTrayWidthRaw = Math.round(toNonNegativeNumber(inputs.timber_tray_width_mm, 500));
  const timberTrayWidthMm = timberTrayWidthRaw === 400 || timberTrayWidthRaw === 500 || timberTrayWidthRaw === 600 ? timberTrayWidthRaw : 500;

  const timberPlaneCount = roofType === 'gable' || roofType === 'hip' || roofType === 'low_gable' ? 2 : 1;
  const timberEdgeRafterCountPerPlaneBase = 2;
  const timberEffectiveLengthMm = Math.max(lengthMmA - 100, 0);
  const timberCommonRafterCountPerPlaneBase = Math.ceil(timberEffectiveLengthMm / TIMBER_RAFTER_SPACING_MM_MAX) + 1;
  const timberRunPerPlaneM = timberPlaneCount === 2 ? projectionM / 2 : projectionM;
  const timberSlopeLenPerPlaneM = timberRunPerPlaneM / effectiveCos;
  const timberSlopeLenPerPlaneMm = timberSlopeLenPerPlaneM * 1000;
  const timberAvailableMm = Math.max(timberSlopeLenPerPlaneMm - 200, 0);
  const timberPurlinLinesPerPlane = Math.ceil(timberAvailableMm / TIMBER_RAFTER_SPACING_MM_MAX) + 1;
  const timberHiddenFinish = 'mill';
  const roofSlopeAreaM2 = roofSurfaceAreaM2;
  const timberTrayWidthM = Math.max(0.1, timberTrayWidthMm / 1000);
  let timberRoofAboveAreaM2 = roofSlopeAreaM2;
  let timberLengthEquivalentM = lengthM;
  let timberCommonRafterCountPerPlane = timberCommonRafterCountPerPlaneBase;
  let timberCommonRafterCountTotal = timberCommonRafterCountPerPlane * timberPlaneCount;
  let timberEdgeRafterCountPerPlane = timberEdgeRafterCountPerPlaneBase;
  let timberEdgeRafterCountTotal = timberEdgeRafterCountPerPlane * timberPlaneCount;
  let timberPurlinTotalM = timberPurlinLinesPerPlane * timberLengthEquivalentM * timberPlaneCount;
  let timberInsulatedPanelCountPerPlane = Math.ceil(timberLengthEquivalentM / 1.2);
  let timberInsulatedPanelCountTotal = timberInsulatedPanelCountPerPlane * timberPlaneCount;
  let timberTraySheetCountPerPlane = Math.ceil(timberLengthEquivalentM / timberTrayWidthM);
  let timberTraySheetCountTotal = timberTraySheetCountPerPlane * timberPlaneCount;
  let covertekAreaM2 = timberRoofAboveAreaM2 * 1.1;
  let polystyreneAreaM2 = timberRoofAboveAreaM2;
  let timberRoofingScrewsSteelCount = Math.ceil(timberRoofAboveAreaM2 * 6);
  let timberRoofingScrewsInsulatedCount = Math.ceil(timberRoofAboveAreaM2 * 4);

  const boxHouseSetbackM = Number(pitchedSetbacksMm?.house_setback_mm ?? 150) / 1000;
  const boxOuterSetbackM = Number(pitchedSetbacksMm?.outer_setback_mm ?? 50) / 1000;
  const boxEaveSetbackM = Number(gableSetbacksMm?.eave_setback_mm ?? 50) / 1000;
  const boxRidgeAllowanceM = Number(gableSetbacksMm?.ridge_allowance_mm ?? 0) / 1000;

  const baseEffectiveRunM = isBoxPerimeter
    ? Math.max(0, rafterRunM - (isBoxGable ? boxEaveSetbackM + boxRidgeAllowanceM : boxHouseSetbackM + boxOuterSetbackM))
    : Math.max(0, rafterRunM - (RAFTER_HOUSE_SETBACK_M + RAFTER_GUTTER_SETBACK_M));
  const effectiveRunM = baseEffectiveRunM;
  const rafterLengthM = rafterRunM / effectiveCos;
  const rafterLengthMAssumed = rafterLengthM;
  const cutRafterLengthM = effectiveRunM / effectiveCos;
  const angleCutAllowanceM = rafterDepthM(rafterProfile) * tanDeg(roofPitchDegUsed);
  const joinerPieceLengthM = cutRafterLengthM + JOINER_EXTRA_M;
  const acrylicRequiredDownslopeM = joinerPieceLengthM;
  const requiredDownslopeM = acrylicRequiredDownslopeM;

  const supportRunM = overhangEnabled ? projectionM - overhangAmountM : baseEffectiveRunM;
  if (overhangEnabled && supportRunM <= 0) {
    warnings.push('INVALID: Overhang amount must be less than the roof span.');
  }

  const slopeDirection: SlopeDirection = invertedEnabled ? 'toward_house' : 'away_from_house';
  const isGableRoof = roofType === 'gable' || roofType === 'low_gable';
  const defaultGableHouseEdgeGutter: 'house' | 'our' =
    inputs.house_connection_type === 'none' ? 'our' : 'house';
  const defaultGableOuterEdgeGutter: 'house' | 'our' = inputs.house_connection_type === 'none' ? 'our' : 'our';
  const gableHouseEdgeGutterUsed: 'house' | 'our' | null = isGableRoof
    ? inputs.house_connection_type === 'none'
      ? 'our'
      : inputs.gable_house_edge_gutter ?? defaultGableHouseEdgeGutter
    : null;
  const gableOuterEdgeGutterUsed: 'house' | 'our' | null = isGableRoof
    ? inputs.house_connection_type === 'none'
      ? 'our'
      : inputs.gable_outer_edge_gutter ?? defaultGableOuterEdgeGutter
    : null;
  const spGutterRunCount =
    isGableRoof && gableHouseEdgeGutterUsed && gableOuterEdgeGutterUsed
      ? (gableHouseEdgeGutterUsed === 'our' ? 1 : 0) + (gableOuterEdgeGutterUsed === 'our' ? 1 : 0)
      : 0;

  const ledgerUndersideHeightM = postCutHeightM;
  const fallM = !isBoxPerimeter && roofType === 'pitched' ? Math.max(0, supportRunM) * tanDeg(roofPitchDegUsed) : 0;
  const postCutHeightHouseSideM = ledgerUndersideHeightM;
  const postCutHeightOuterSideRawM =
    Number.isFinite(fallM) && Number.isFinite(ledgerUndersideHeightM)
      ? ledgerUndersideHeightM + (slopeDirection === 'toward_house' ? fallM : -fallM)
      : ledgerUndersideHeightM;
  const postCutHeightOuterSideM = Math.max(0, postCutHeightOuterSideRawM);

  const ridgeLengthM =
    roofType === 'low_gable' || roofType === 'gable'
      ? lengthM
      : roofType === 'hip'
        ? Math.max(0, lengthM - projectionM)
        : 0;

  const hipRafterCount = roofType === 'hip' ? 4 : 0;

  const roofPlaneCount = roofType === 'pitched' ? 1 : 2;

  const roofPlanes =
    roofType === 'pitched'
      ? [
          {
            id: 'main',
            label: 'Main',
            bay_count: bayCountA,
            rafter_length_m: projectionM / effectiveCos,
            roof_area_m2: (lengthM * projectionM) / effectiveCos,
          },
        ]
      : roofType === 'hip_corner'
        ? [
            {
              id: 'A',
              label: 'Leg A',
              bay_count: bayCountA,
              rafter_length_m: projectionM / effectiveCos,
              roof_area_m2: (lengthM * projectionM) / effectiveCos,
            },
            {
              id: 'B',
              label: 'Leg B',
              bay_count: bayCountB,
              rafter_length_m: Math.max(0, hipCornerProjectionBM) / effectiveCos,
              roof_area_m2: (hipCornerLengthBM * hipCornerProjectionBM) / effectiveCos,
            },
          ]
        : [
            {
              id: 'A',
              label: 'Side A',
              bay_count: bayCountA,
              rafter_length_m: (projectionM / 2) / effectiveCos,
              roof_area_m2: ((lengthM * projectionM) / 2) / effectiveCos,
            },
            {
              id: 'B',
              label: 'Side B',
              bay_count: bayCountA,
              rafter_length_m: (projectionM / 2) / effectiveCos,
              roof_area_m2: ((lengthM * projectionM) / 2) / effectiveCos,
            },
          ];

  let mixedRoofNormalized: MixedRoofNormalizedV1 | null = null;
  let acrylicAreaM2 = 0;
  let timberAreaM2 = 0;
  let acrylicBaysTotal: number | undefined = undefined;
  let acrylicPlaneCountUsed = 0;
  if (inputs.roof_material === 'acrylic') {
    acrylicAreaM2 = roofSurfaceAreaM2;
    timberAreaM2 = 0;
    acrylicBaysTotal = bayCount;
  } else if (inputs.roof_material === 'timber') {
    acrylicAreaM2 = 0;
    timberAreaM2 = roofSurfaceAreaM2;
    acrylicBaysTotal = 0;
  } else if (inputs.roof_material === 'mixed') {
    const mixedLengthM = roofType === 'hip_corner' ? lengthM + hipCornerLengthBM : lengthM;
    const mixed = normalizeMixedRoof(inputs, { lengthM: mixedLengthM, roofSurfaceAreaM2, roofPlanes, config });
    mixedRoofNormalized = mixed.normalized;
    acrylicAreaM2 = mixed.acrylicAreaM2;
    timberAreaM2 = mixed.timberAreaM2;
    if (typeof mixed.acrylicBaysTotal === 'number') acrylicBaysTotal = mixed.acrylicBaysTotal;
    acrylicPlaneCountUsed = mixed.acrylicPlaneCountUsed;
    warnings.push(...mixed.warnings);
    if (roofType === 'hip_corner' && mixed.normalized.mode === 'ridge_skylight')
      warnings.push('Hip corner mixed roof assumes ridge length = length A + length B.');
  }

  if (inputs.roof_material === 'mixed') {
    timberRoofAboveAreaM2 = Math.max(0, timberAreaM2);
    const slopeAreaPerPlane = timberSlopeLenPerPlaneM * timberPlaneCount;
    const lengthEquivalentRaw =
      timberRoofAboveAreaM2 > 0 && Number.isFinite(slopeAreaPerPlane) && slopeAreaPerPlane > 0
        ? timberRoofAboveAreaM2 / slopeAreaPerPlane
        : 0;
    timberLengthEquivalentM = clampNumber(lengthEquivalentRaw, 0, lengthM);

    const effectiveLengthMm = Math.max(timberLengthEquivalentM * 1000 - 100, 0);
    timberCommonRafterCountPerPlane =
      timberRoofAboveAreaM2 > 0 ? Math.ceil(effectiveLengthMm / TIMBER_RAFTER_SPACING_MM_MAX) + 1 : 0;
    timberCommonRafterCountTotal = timberCommonRafterCountPerPlane * timberPlaneCount;
    timberEdgeRafterCountPerPlane = timberRoofAboveAreaM2 > 0 ? timberEdgeRafterCountPerPlaneBase : 0;
    timberEdgeRafterCountTotal = timberEdgeRafterCountPerPlane * timberPlaneCount;
    timberPurlinTotalM =
      timberRoofAboveAreaM2 > 0 ? timberPurlinLinesPerPlane * timberLengthEquivalentM * timberPlaneCount : 0;
    timberInsulatedPanelCountPerPlane = timberRoofAboveAreaM2 > 0 ? Math.ceil(timberLengthEquivalentM / 1.2) : 0;
    timberInsulatedPanelCountTotal = timberInsulatedPanelCountPerPlane * timberPlaneCount;
    timberTraySheetCountPerPlane = timberRoofAboveAreaM2 > 0 ? Math.ceil(timberLengthEquivalentM / timberTrayWidthM) : 0;
    timberTraySheetCountTotal = timberTraySheetCountPerPlane * timberPlaneCount;
    covertekAreaM2 = timberRoofAboveAreaM2 * 1.1;
    polystyreneAreaM2 = timberRoofAboveAreaM2;
    timberRoofingScrewsSteelCount = Math.ceil(timberRoofAboveAreaM2 * 6);
    timberRoofingScrewsInsulatedCount = Math.ceil(timberRoofAboveAreaM2 * 4);
  }

  const rafterCountUsed = inputs.roof_material === 'timber' ? timberCommonRafterCountPerPlane : rafterCount;

  const acrylicSheetAreaM2 = DEFAULT_ACRYLIC_SHEET_LENGTH_M * DEFAULT_ACRYLIC_SHEET_WIDTH_M;
  const acrylicSheetCount =
    inputs.roof_material === 'acrylic' || inputs.roof_material === 'mixed'
      ? Math.max(0, Math.ceil(acrylicAreaM2 / acrylicSheetAreaM2))
      : 0;

  const coverageMultiplier = roofType === 'pitched' || roofType === 'hip_corner' ? 1 : roofPlaneCount;
  const baseLinearLength = roofType === 'hip_corner' ? lengthM + hipCornerLengthBM : lengthM;
  const foamLengthM = baseLinearLength * coverageMultiplier;

  const flashingDefaultCandidates: Array<Omit<FlashingDefaultNormalizedV1, 'selected_band'>> = [];
  const pushFlashingDefault = (key: string, label: string, defaultBand: FlashingBandV1, lengthMRaw: number) => {
    const lengthM = Math.max(0, Number(lengthMRaw));
    if (!Number.isFinite(lengthM) || lengthM <= 0) return;
    flashingDefaultCandidates.push({
      key,
      label,
      length_m: lengthM,
      default_band: defaultBand,
    });
  };

  const roofLengthForFlashingM = Math.max(0, baseLinearLength);
  if (roofType === 'pitched') {
    pushFlashingDefault('pitched_primary', 'Primary flashing', FLASHING_BAND_201_300, roofLengthForFlashingM);
    if (slopeDirection === 'toward_house') {
      pushFlashingDefault('pitched_secondary', 'Secondary flashing', FLASHING_BAND_201_300, roofLengthForFlashingM);
    }
  } else if (roofType === 'gable' || roofType === 'low_gable') {
    pushFlashingDefault('gable_ridge', 'Ridge flashing', FLASHING_BAND_301_400, roofLengthForFlashingM);
  } else if (roofType === 'hip') {
    const hipLedgerLengthM = inputs.house_connection_type !== 'none' ? Math.max(0, lengthM) : roofLengthForFlashingM;
    pushFlashingDefault('hip_ledger', 'Hip ledger flashing', FLASHING_BAND_201_300, hipLedgerLengthM || roofLengthForFlashingM);
  } else {
    pushFlashingDefault('roof_primary', 'Primary flashing', FLASHING_BAND_201_300, roofLengthForFlashingM);
  }

  const includeTimberEdgeFlashings =
    inputs.roof_material === 'timber' || (inputs.roof_material === 'mixed' && Math.max(0, timberAreaM2) > 1e-6);
  if (includeTimberEdgeFlashings) {
    const edgeLengthM = Math.max(0, rafterLengthM + FLASHING_EDGE_ALLOWANCE_M);
    if (roofType === 'pitched') {
      pushFlashingDefault('timber_edge_left', 'Timber edge rafter flashing (left)', FLASHING_BAND_0_200, edgeLengthM);
      pushFlashingDefault('timber_edge_right', 'Timber edge rafter flashing (right)', FLASHING_BAND_0_200, edgeLengthM);
    } else if (roofType === 'gable' || roofType === 'low_gable') {
      pushFlashingDefault('timber_edge_a_left', 'Timber edge rafter flashing (A left)', FLASHING_BAND_0_200, edgeLengthM);
      pushFlashingDefault('timber_edge_a_right', 'Timber edge rafter flashing (A right)', FLASHING_BAND_0_200, edgeLengthM);
      pushFlashingDefault('timber_edge_b_left', 'Timber edge rafter flashing (B left)', FLASHING_BAND_0_200, edgeLengthM);
      pushFlashingDefault('timber_edge_b_right', 'Timber edge rafter flashing (B right)', FLASHING_BAND_0_200, edgeLengthM);
    } else if (roofType === 'hip') {
      warnings.push('Timber hip edge-rafter flashings are not configured yet; skipping timber edge flashing defaults.');
    }
  }

  const defaultOverrideMap = new Map<string, FlashingBandOrNoneV1>();
  const rawDefaultOverrides = Array.isArray(inputs.flashings?.default_overrides) ? inputs.flashings.default_overrides : [];
  for (const override of rawDefaultOverrides) {
    const key = String(override?.key ?? '').trim();
    if (!key) continue;
    const selectedBand = normalizeFlashingBandOrNone(override?.band ?? FLASHING_BAND_0_200);
    defaultOverrideMap.set(key, selectedBand);
  }

  const flashingDefaults: FlashingNormalizedV1['defaults'] = flashingDefaultCandidates.map((candidate) => {
    const selectedBand = defaultOverrideMap.get(candidate.key) ?? candidate.default_band;
    return {
      ...candidate,
      selected_band: selectedBand,
    };
  });

  const flashingExtras: FlashingNormalizedV1['extras'] = [];
  const rawFlashingExtras = Array.isArray(inputs.flashings?.extras) ? inputs.flashings.extras : [];
  for (const extra of rawFlashingExtras) {
    const lengthM = toNonNegativeNumber((extra as any)?.length_m, NaN);
    if (!Number.isFinite(lengthM) || lengthM <= 0) continue;
    flashingExtras.push({
      band: normalizeFlashingBand((extra as any)?.band ?? FLASHING_BAND_0_200),
      length_m: lengthM,
    });
  }

  const flashingTotalsByBand: Record<FlashingBandV1, number> = {
    '0-200': 0,
    '201-300': 0,
    '301-400': 0,
  };

  for (const item of flashingDefaults) {
    if (item.selected_band === 'none') continue;
    flashingTotalsByBand[item.selected_band] += item.length_m;
  }
  for (const item of flashingExtras) {
    flashingTotalsByBand[item.band] += item.length_m;
  }

  const flashingLengthM = FLASHING_BANDS.reduce((sum, band) => sum + Math.max(0, flashingTotalsByBand[band]), 0);
  const flashingStartupCount = flashingLengthM > 0 ? 1 : 0;
  const flashingsNormalized: FlashingNormalizedV1 = {
    defaults: flashingDefaults,
    extras: flashingExtras,
    totals_m_by_band: flashingTotalsByBand,
    total_length_m: flashingLengthM,
  };

  const travel = toNonNegativeNumber(inputs.travel_ex_gst, 0);
  const extras = toNonNegativeNumber(inputs.extras_allowance_ex_gst, 0);

  const quoteDiscountPct = clampNumber(toNonNegativeNumber(inputs.quote_discount_pct, 0), 0, 80);

  const structureDefaults = (config?.rules as any)?.defaults?.structure_defaults ?? {};
  const pitchedDefaults = structureDefaults?.pitched ?? {};
  const boxDefaults = structureDefaults?.box_perimeter ?? {};

  const defaultFrontBeamProfile = String(pitchedDefaults?.front_beam_profile ?? 'SP Gutter');
  const defaultBoxBeamProfile = String(boxDefaults?.perimeter_beam_profile_default ?? '300x50');
  const defaultPostProfile = String(pitchedDefaults?.posts_profile ?? '100x100');

  const frontBeamProfileUsed = structureType === 'pitched' ? overrideFrontBeamProfile ?? defaultFrontBeamProfile : null;
  const integratedGutterBeam = structureType === 'pitched' && isGutterBeamProfile(frontBeamProfileUsed);
  const frontBeamLengthM =
    structureType === 'pitched' && frontBeamProfileUsed && !integratedGutterBeam
      ? roofType === 'hip_corner'
        ? Math.max(0, lengthM) + Math.max(0, hipCornerLengthBM)
        : Math.max(0, lengthM)
      : 0;
  const separateGutterEnabledRaw = inputs.separate_gutter_enabled === true;

  const invertedHouseGutter = invertedEnabled ? inputs.inverted_house_gutter !== false : false;
  let gutterMode: GutterMode = 'default';
  if (invertedEnabled && invertedHouseGutter) gutterMode = 'none';
  else if (invertedEnabled && !invertedHouseGutter) gutterMode = 'sp_gutter_house_edge';
  else if (overhangEnabled) gutterMode = 'overhang_gutter_front_edge';
  else if (!integratedGutterBeam) gutterMode = 'none';

  const separateGutterEnabled =
    separateGutterEnabledRaw &&
    !integratedGutterBeam &&
    !overhangEnabled &&
    !invertedEnabled &&
    !isBoxPerimeter;

  if (separateGutterEnabledRaw && !separateGutterEnabled) {
    warnings.push('Separate gutter ignored because gutters are integrated, inverted, overhang, or box perimeter.');
  }

  let gutterAssemblyMode: GutterAssemblyMode = 'none';
  if (!invertedEnabled && !overhangEnabled && !isBoxPerimeter) {
    if (integratedGutterBeam) gutterAssemblyMode = 'integrated';
    else if (separateGutterEnabled) gutterAssemblyMode = 'separate';
  }

  let hasLedger = inputs.house_connection_type !== 'none';
  if (isGableRoof) {
    if (inputs.house_connection_type === 'none') {
      hasLedger = false;
    } else if (gableHouseEdgeGutterUsed === 'our') {
      hasLedger = false;
    } else if (gableHouseEdgeGutterUsed === 'house') {
      hasLedger = true;
    }
  } else if (roofType === 'pitched' && gutterMode === 'sp_gutter_house_edge') {
    hasLedger = false;
  }

  const ledgerProfileDefault = roofPitchDegUsed <= 5 ? rafterProfile : oneSizeUpProfile(rafterProfile);
  const ledgerProfileAuto = hasLedger ? ledgerProfileDefault : rafterProfile;
  const ledgerProfileUsed: string = overrideLedgerProfile ?? ledgerProfileAuto;
  const ledgerLengthM = hasLedger ? lengthM : 0;

  const gableEndFrameCount =
    roofType === 'gable'
      ? gableEndFramesMode === 'both_ends'
        ? 2
        : gableEndFramesMode === 'outer_end_only'
          ? 1
          : 0
      : 0;
  const tieBeamProfileDefault = integratedGutterBeam ? '150x50' : frontBeamProfileUsed ?? '150x50';
  const tieBeamProfileUsed = overrideTieBeamProfile ?? tieBeamProfileDefault;
  const strutProfileUsed = overrideStrutProfile ?? '50x50';
  const houseEdgeIsSpOrHouse =
    gutterMode === 'sp_gutter_house_edge' || invertedHouseGutter || (isGableRoof && gableHouseEdgeGutterUsed === 'our');
  const farEdgeIsSpGutter = isGableRoof ? gableOuterEdgeGutterUsed === 'our' : integratedGutterBeam;
  const houseEdgeAllowanceM = houseEdgeIsSpOrHouse ? 0.1 : profileWidthM(ledgerProfileUsed);
  const farEdgeAllowanceM = farEdgeIsSpGutter ? 0.1 : profileWidthM(frontBeamProfileUsed ?? tieBeamProfileUsed);
  const tieBeamLengthM = Math.max(0, projectionM - houseEdgeAllowanceM - farEdgeAllowanceM);
  const kingpostStrutLengthM = Math.max(0, tanDeg(roofPitchDegUsed) * (projectionM / 2));

  const boxPerimeterBeamProfileUsed = isBoxPerimeter ? overrideBoxPerimeterBeamProfile ?? defaultBoxBeamProfile : null;
  const postProfileUsed = overridePostProfile ?? defaultPostProfile;
  const ridgeBeamProfileUsed = isBoxGable ? overrideRidgeBeamProfile ?? '100x50' : overrideRidgeBeamProfile ?? null;

  const gutterLengthRaw = toNonNegativeNumber(inputs.gutter_length_m, NaN);

  const hasHouseConnection = inputs.house_connection_type !== 'none';
  const defaultBoxGutterHouseEdge: BoxGutterEdge = hasHouseConnection ? 'house' : 'none';
  const defaultBoxGutterFarEdge: BoxGutterEdge = hasHouseConnection ? 'our' : 'none';

  const boxGutterHouseEdge: BoxGutterEdge =
    isBoxPerimeter && inputs.box_gutter_house_edge
      ? inputs.box_gutter_house_edge
      : isBoxPerimeter
        ? defaultBoxGutterHouseEdge
        : 'none';
  const boxGutterFarEdge: BoxGutterEdge =
    isBoxPerimeter && inputs.box_gutter_far_edge
      ? inputs.box_gutter_far_edge
      : isBoxPerimeter
        ? defaultBoxGutterFarEdge
        : 'none';

  const boxHouseGutterLengthM = isBoxPerimeter
    ? baseLinearLength * (boxGutterHouseEdge === 'house' ? 1 : 0) + baseLinearLength * (boxGutterFarEdge === 'house' ? 1 : 0)
    : 0;
  const boxOurGutterLengthM = isBoxPerimeter
    ? baseLinearLength * (boxGutterHouseEdge === 'our' ? 1 : 0) + baseLinearLength * (boxGutterFarEdge === 'our' ? 1 : 0)
    : 0;
  const gableHouseGutterLengthM =
    isGableRoof && gableHouseEdgeGutterUsed === 'house' ? baseLinearLength : 0;
  const gableOuterGutterLengthM =
    isGableRoof && gableOuterEdgeGutterUsed === 'house' ? baseLinearLength : 0;
  const houseGutterLengthM = isGableRoof ? gableHouseGutterLengthM + gableOuterGutterLengthM : boxHouseGutterLengthM;

  const gutterRunLengthM = baseLinearLength;
  const spGutterRunCountUsed =
    isGableRoof
      ? spGutterRunCount
      : gutterMode === 'sp_gutter_house_edge' || (gutterMode === 'default' && gutterAssemblyMode === 'integrated')
        ? 1
        : 0;
  let ourGutterLengthM = 0;
  if (isBoxPerimeter) {
    ourGutterLengthM = boxOurGutterLengthM;
  } else if (isGableRoof) {
    ourGutterLengthM = gutterRunLengthM * spGutterRunCountUsed;
  } else if (
    gutterMode === 'sp_gutter_house_edge' ||
    gutterAssemblyMode === 'integrated' ||
    gutterAssemblyMode === 'separate' ||
    gutterMode === 'overhang_gutter_front_edge'
  ) {
    ourGutterLengthM = gutterRunLengthM;
  }

  const separateGutterLengthM = separateGutterEnabled
    ? Number.isFinite(gutterLengthRaw) && gutterLengthRaw > 0
      ? gutterLengthRaw
      : baseLinearLength
    : 0;

  const gutterLengthM = isBoxPerimeter
    ? ourGutterLengthM
    : gutterMode === 'none'
      ? 0
      : gutterMode === 'sp_gutter_house_edge' || gutterMode === 'overhang_gutter_front_edge'
        ? baseLinearLength
        : Number.isFinite(gutterLengthRaw) && gutterLengthRaw > 0
          ? gutterLengthRaw
          : baseLinearLength;

  const hasOurGutter = ourGutterLengthM > 0;

  const downpipeCountRaw = toNonNegativeNumber(inputs.downpipe_count, NaN);
  const downpipeCount =
    Number.isFinite(downpipeCountRaw) && downpipeCountRaw > 0 ? Math.round(downpipeCountRaw) : ourGutterLengthM > 0 ? 1 : 0;
  const downpipeJoinCountRaw = toNonNegativeNumber(inputs.downpipe_join_count, 0);
  const downpipeJoinCountUsed = clampNumber(Math.round(downpipeJoinCountRaw), 0, 20);
  const downpipeElbowCountRaw = toNonNegativeNumber(inputs.downpipe_elbow_count, 0);
  const downpipeElbowCountUsed = hasOurGutter ? clampNumber(Math.round(downpipeElbowCountRaw), 0, 40) : 0;
  if (!hasOurGutter && downpipeElbowCountRaw > 0) {
    warnings.push('DP elbows ignored because no gutter is selected.');
  }

  const timberAllowanceRaw = toNonNegativeNumber(inputs.timber_roof_allowance_ex_gst, 0);
  if (timberAllowanceRaw > 0) warnings.push('Timber roof allowance input is deprecated and ignored (timber roof is now a takeoff).');

  const powdercoatStandardRaw =
    typeof inputs.powdercoat_standard_colour === 'string' ? inputs.powdercoat_standard_colour.trim() : '';
  const powdercoatCustomRaw =
    typeof inputs.powdercoat_custom_colour === 'string' ? inputs.powdercoat_custom_colour.trim() : '';
  const powdercoatIsCustom = inputs.powdercoat_is_custom === true;

  let powdercoatColourUsed: string | null = null;
  let powdercoatMultiplier: number | null = null;

  if (inputs.extrusion_colour === 'Mill') {
    if (powdercoatIsCustom && powdercoatCustomRaw) {
      powdercoatColourUsed = powdercoatCustomRaw;
      powdercoatMultiplier = 1.2;
    } else if (!powdercoatIsCustom && powdercoatStandardRaw) {
      powdercoatColourUsed = powdercoatStandardRaw;
      powdercoatMultiplier = 1.0;
    } else {
      warnings.push('INVALID: Mill finish selected but powdercoat colour not specified (raw mill not permitted).');
      powdercoatColourUsed = powdercoatStandardRaw || 'Ironsands';
      powdercoatMultiplier = 1.0;
    }
  }

  const visibleFinishUsed = 'default';
  const timberEdgeRafterProfileUsed = TIMBER_EDGE_RAFTER_PROFILE;
  const timberEdgeRafterFinishUsed = visibleFinishUsed;

  // === Rafter pre-cut takeoff (v2): edge allowances + LengthA ===
  // Notes:
  // - We ONLY change rafter takeoff outputs used by BOM (derived.rafter_cut_length_m + gable side fields).
  // - We do NOT change post-height / fall geometry in this sprint.
  // - LengthA uses existing angleCutAllowanceM (= rafter depth x tan(pitch)).
  const RAFTER_BEAM_ONLY_M = 0.05; // 50mm
  const RAFTER_SP_GUTTER_M = 0.1; // 100mm (beam + gutter combined)
  const RAFTER_BEAM_PLUS_GUTTER_M = 0.15; // 150mm

  const isGableLike = roofType === 'gable' || roofType === 'low_gable';

  const ourGutterAllowanceM =
    integratedGutterBeam ? RAFTER_SP_GUTTER_M : RAFTER_BEAM_PLUS_GUTTER_M;

  const ridgeProfileForTakeoff =
    isGableLike ? (ridgeBeamProfileUsed ?? '100x50') : (ridgeBeamProfileUsed ?? '100x50');
  const ridgeHalfM = isGableLike ? profileWidthM(ridgeProfileForTakeoff) / 2 : 0;

  type RafterTakeoff = {
    run_m_takeoff: number;
    cut_length_m: number;
    // gable
    run_house_side_m?: number;
    run_outer_side_m?: number;
    cut_house_side_m?: number;
    cut_outer_side_m?: number;
    ridge_half_m?: number;
    // pitched debug
    house_allowance_m?: number;
    far_allowance_m?: number;
  };

  const rafterTakeoff: RafterTakeoff = (() => {
    // Default fallback keeps existing behavior but adds LengthA.
    const fallbackRun = Number.isFinite(effectiveRunM) ? effectiveRunM : 0;
    const fallbackCut = (Number.isFinite(cutRafterLengthM) ? cutRafterLengthM : 0) + angleCutAllowanceM;

    // --- Pitched (single plane) ---
    if (roofType === 'pitched') {
      const beamWidthM = profileWidthM(frontBeamProfileUsed ?? '100x50'); // defaults to 50mm if unknown
      const ledgerWidthM = hasLedger ? profileWidthM(ledgerProfileUsed) : beamWidthM;

      let houseAllowanceM = 0;
      let farAllowanceM = 0;

      if (slopeDirection === 'away_from_house') {
        // House side is ledger; far side is gutter edge.
        houseAllowanceM = ledgerWidthM;

        if (integratedGutterBeam) farAllowanceM = RAFTER_SP_GUTTER_M;
        else if (separateGutterEnabled) farAllowanceM = RAFTER_BEAM_PLUS_GUTTER_M;
        else farAllowanceM = beamWidthM; // beam only
      } else {
        // Inverted: gutter edge is house side.
        // House gutter exists ONLY when inverted + inverted_house_gutter => beam only.
        houseAllowanceM = invertedHouseGutter ? beamWidthM : RAFTER_SP_GUTTER_M;
        farAllowanceM = beamWidthM; // high edge is beam only
      }

      const runTakeoff = Math.max(0, projectionM - houseAllowanceM - farAllowanceM);
      const cutLen = runTakeoff / effectiveCos + angleCutAllowanceM;

      return {
        run_m_takeoff: runTakeoff,
        cut_length_m: cutLen,
        house_allowance_m: houseAllowanceM,
        far_allowance_m: farAllowanceM,
      };
    }

    // --- Gable / Low-gable (two planes; split by side) ---
    if (isGableLike) {
      const halfSpan = projectionM / 2;

      // Per-edge eave allowance:
      // - 'house' => beam only (50mm)
      // - 'our'   => SP (100mm) if integrated gutter beam, else beam+gutter (150mm)
      const houseEaveAllowance =
        gableHouseEdgeGutterUsed === 'house' ? RAFTER_BEAM_ONLY_M : ourGutterAllowanceM;
      const outerEaveAllowance =
        gableOuterEdgeGutterUsed === 'house' ? RAFTER_BEAM_ONLY_M : ourGutterAllowanceM;

      const runHouse = Math.max(0, halfSpan - ridgeHalfM - houseEaveAllowance);
      const runOuter = Math.max(0, halfSpan - ridgeHalfM - outerEaveAllowance);

      const cutHouse = runHouse / effectiveCos + angleCutAllowanceM;
      const cutOuter = runOuter / effectiveCos + angleCutAllowanceM;

      return {
        run_m_takeoff: Math.max(runHouse, runOuter), // backwards-safe representative
        cut_length_m: Math.max(cutHouse, cutOuter), // backwards-safe representative
        run_house_side_m: runHouse,
        run_outer_side_m: runOuter,
        cut_house_side_m: cutHouse,
        cut_outer_side_m: cutOuter,
        ridge_half_m: ridgeHalfM,
      };
    }

    // Other roof types: keep existing run/cut behavior but add LengthA.
    return { run_m_takeoff: fallbackRun, cut_length_m: fallbackCut };
  })();

  const inputsNormalized: InputsNormalizedV1 = {
    length_m: lengthM,
    projection_m: projectionM,
    hip_corner_length_b_m: roofType === 'hip_corner' ? hipCornerLengthBM : null,
    hip_corner_projection_b_m: roofType === 'hip_corner' ? hipCornerProjectionBM : null,
    post_cut_height_m: postCutHeightOuterSideM,
    roof_pitch_deg: roofPitchDeg,

    structure_type: structureType,
    pergola_style_ui: styleNormalized.style,
    roof_material: inputs.roof_material,
    roof_type: roofType,
    extrusion_colour: inputs.extrusion_colour,
    gable_end_frames_mode: gableEndFramesMode,
    powdercoat_standard_colour: powdercoatStandardRaw || undefined,
    powdercoat_is_custom: powdercoatIsCustom || undefined,
    powdercoat_custom_colour: powdercoatCustomRaw || undefined,
    mixed_roof: mixedRoofNormalized,

    post_count: postCount,
    house_connection_type: inputs.house_connection_type,
    // PR-F (2026-05-22): echo the resolved attachment length (input value
    // or the lengthMmA default) so consumers can read it without
    // recomputing the default.
    attachment_length_mm: attachmentLengthMmA,
    post_connection_type: inputs.post_connection_type,
    access: inputs.access,
    height: inputs.height,
    ground,

    box_beam_profile: structureType === 'box_perimeter' ? boxPerimeterBeamProfileUsed : null,
    fall_distance_mm: fallDistanceMm,
    gutter_length_m: gutterLengthM,
    downpipe_count: downpipeCount,
    downpipe_join_count: downpipeJoinCountUsed,
    downpipe_elbow_count: downpipeElbowCountUsed,
    box_gutter_house_edge: boxGutterHouseEdge,
    box_gutter_far_edge: boxGutterFarEdge,
    gable_house_edge_gutter: gableHouseEdgeGutterUsed ?? undefined,
    gable_outer_edge_gutter: gableOuterEdgeGutterUsed ?? undefined,
    overhang_enabled: overhangEnabled,
    overhang_amount_m: overhangAmountM,
    overhang_support_beam_profile: overhangSupportBeamProfile,
    inverted_enabled: invertedEnabled,
    inverted_house_gutter: invertedHouseGutter,
    separate_gutter_enabled: separateGutterEnabled,

    rafter_profile: rafterProfile,
    gutter_type:
      structureType === 'box_perimeter'
        ? ourGutterLengthM > 0
          ? 'box_gutter_100x100_cut'
          : null
        : (isGableRoof ? spGutterRunCountUsed > 0 : gutterMode === 'sp_gutter_house_edge' || (gutterMode === 'default' && gutterAssemblyMode === 'integrated'))
          ? 'sp_gutter'
          : null,
    acrylic_sheet_count: acrylicSheetCount,
    flashing_length_m: flashingLengthM,
    foam_length_m: foamLengthM,
    flashings: flashingsNormalized,

    travel_ex_gst: travel,
    extras_allowance_ex_gst: extras,
    timber_roof_allowance_ex_gst: 0,
    timber_roof_above_type: timberRoofAboveType,
    timber_insulated_panel_thickness_mm: timberInsulatedPanelThicknessMm,
    timber_tray_width_mm: timberTrayWidthMm,

    quote_discount_pct: quoteDiscountPct,
  };

  const totalRafterPieces =
    inputs.roof_material === 'timber'
      ? timberCommonRafterCountTotal + timberEdgeRafterCountTotal
      : roofType === 'low_gable' || roofType === 'gable' || roofType === 'hip'
        ? rafterCount * 2
        : rafterCount;
  const representativeCommonRafterCutLengthM =
    isGableLike && Number.isFinite(rafterTakeoff.cut_house_side_m) && Number.isFinite(rafterTakeoff.cut_outer_side_m)
      ? (Math.max(0, Number(rafterTakeoff.cut_house_side_m)) + Math.max(0, Number(rafterTakeoff.cut_outer_side_m))) / 2
      : Math.max(0, Number(rafterTakeoff.cut_length_m));
  const hipRafterCutLengthM =
    roofType === 'hip' ? Math.max(0, ((projectionM / 2) * Math.SQRT2) / effectiveCos + angleCutAllowanceM) : 0;
  const totalInstalledRafterLengthM = Math.max(
    0,
    totalRafterPieces * representativeCommonRafterCutLengthM + hipRafterCount * hipRafterCutLengthM,
  );
  const joinerRunsTotal = roofType === 'low_gable' || roofType === 'gable' || roofType === 'hip' ? rafterCount * 2 : rafterCount;
  const rafterClearLenMm = isAcrylicRoof ? rafterA.clearLenMm : 0;
  const rafterSpacingMm = isAcrylicRoof && rafterCountA > 1 ? rafterA.clearLenMm / (rafterCountA - 1) : 0;

  const derived: DerivedResultV1['derived'] = {
    area_m2: areaM2,
    length_m: lengthM,
    projection_m: projectionM,
    roof_length_m: lengthM,
    roof_span_m: projectionM,
    roof_plane_span_m: rafterRunM,
    roof_plane_sloped_downslope_m: rafterLengthM,
    roof_area_total_m2: areaM2,
    overhang_enabled: overhangEnabled,
    overhang_amount_m: overhangAmountM,
    overhang_support_beam_profile_used: overhangSupportBeamProfile,
    overhang_support_beam_length_m: overhangEnabled ? lengthM : 0,
    overhang_stringer_profile_used: overhangEnabled ? rafterProfile : null,
    overhang_stringer_length_m: overhangEnabled ? lengthM : 0,
    overhang_end_cap_count: overhangEnabled ? 4 : 0,
    inverted_enabled: invertedEnabled,
    inverted_house_gutter: invertedHouseGutter,
    slope_direction: slopeDirection,
    gutter_mode: gutterMode,
    gutter_assembly_mode: gutterAssemblyMode,
    integrated_gutter_beam: integratedGutterBeam,
    has_our_gutter: hasOurGutter,
    our_gutter_length_m: ourGutterLengthM,
    house_gutter_length_m: houseGutterLengthM,
    sp_gutter_run_count: spGutterRunCountUsed,
    separate_gutter_enabled: separateGutterEnabled,
    separate_gutter_length_m: separateGutterLengthM,
    ledger_profile_used: ledgerProfileUsed,
    has_ledger: hasLedger,
    ledger_length_m: ledgerLengthM,
    front_beam_profile_used: frontBeamProfileUsed,
    front_beam_length_m: frontBeamLengthM,
    tie_beam_profile_used: tieBeamProfileUsed,
    strut_profile_used: strutProfileUsed,
    ridge_beam_profile_used: ridgeBeamProfileUsed,
    box_perimeter_beam_profile_used: boxPerimeterBeamProfileUsed,
    post_profile_used: postProfileUsed,
    ledger_underside_height_m: ledgerUndersideHeightM,
    post_cut_height_house_side_m: postCutHeightHouseSideM,
    post_cut_height_outer_side_m: postCutHeightOuterSideM,
    ...(isBoxPerimeter
      ? {
          box_max_fall_mm: boxMaxFallMm,
          box_effective_run_m: boxEffectiveRunM ?? effectiveRunM,
          box_pitch_deg_used: boxPitchDegUsed ?? roofPitchDegUsed,
          box_rise_mm: boxRiseMm ?? Math.tan(degToRad(roofPitchDegUsed)) * (boxEffectiveRunM ?? effectiveRunM) * 1000,
          box_max_supported_run_m_at_min_pitch: boxMaxSupportedRunMAtMinPitch,
          box_max_supported_span_m: boxMaxSupportedSpanM,
          our_gutter_length_m: ourGutterLengthM,
          house_gutter_length_m: houseGutterLengthM,
        }
      : null),
    module_count: 1,
    ...(roofType === 'hip_corner'
      ? {
          hip_corner_length_b_m: hipCornerLengthBM,
          hip_corner_projection_b_m: hipCornerProjectionBM,
          hip_corner_rafter_count_a: rafterCountA,
          hip_corner_rafter_count_b: rafterCountB,
        }
      : null),
    rafter_count: rafterCountUsed,
    ...(isAcrylicRoof
      ? {
          rafter_clear_len_mm: rafterClearLenMm,
          rafter_spacing_mm: rafterSpacingMm,
        }
      : null),
    attachment_length_m: roofType === 'hip_corner' ? lengthM : attachmentLengthMmA / 1000,
    bracket_count: bracketCount,
    stringer_fixing_count: stringerFixingCount,
    bay_count: bayCount,
    rafter_profile_auto: rafterProfileAuto,
    rafter_length_m_assumed: rafterLengthMAssumed,
    roof_pitch_deg_used: roofPitchDegUsed,
    rafter_run_m: rafterRunM,
    rafter_length_m: rafterLengthM,
    rafter_run_m_takeoff: rafterTakeoff.run_m_takeoff,
    rafter_cut_length_m: rafterTakeoff.cut_length_m,
    // gable/low_gable per-side rafters
    ...(isGableLike
      ? {
          rafter_run_house_side_m: rafterTakeoff.run_house_side_m,
          rafter_run_outer_side_m: rafterTakeoff.run_outer_side_m,
          rafter_cut_length_house_side_m: rafterTakeoff.cut_house_side_m,
          rafter_cut_length_outer_side_m: rafterTakeoff.cut_outer_side_m,
          rafter_ridge_half_m: rafterTakeoff.ridge_half_m,
        }
      : null),
    // pitched debug allowances
    ...(roofType === 'pitched'
      ? {
          rafter_house_allowance_m: rafterTakeoff.house_allowance_m,
          rafter_far_allowance_m: rafterTakeoff.far_allowance_m,
        }
      : null),
    ...(roofType === 'hip'
      ? {
          hip_rafter_cut_length_m: hipRafterCutLengthM,
        }
      : null),
    joiner_piece_length_m: joinerPieceLengthM,
    effective_run_m: effectiveRunM,
    required_downslope_m: requiredDownslopeM,
    cut_rafter_length_m: rafterTakeoff.cut_length_m,
    angle_cut_allowance_m: angleCutAllowanceM,
    acrylic_required_downslope_m: acrylicRequiredDownslopeM,
    total_roof_area_m2: roofSurfaceAreaM2,
    roof_surface_area_m2: roofSurfaceAreaM2,
    ridge_length_m: ridgeLengthM,
    acrylic_area_m2: acrylicAreaM2,
    timber_area_m2: timberAreaM2,
    timber_plane_count: timberPlaneCount,
    visible_finish_used: visibleFinishUsed,
    timber_edge_rafter_profile_used: timberEdgeRafterProfileUsed,
    timber_edge_rafter_finish_used: timberEdgeRafterFinishUsed,
    timber_edge_rafter_count_per_plane: timberEdgeRafterCountPerPlane,
    timber_edge_rafter_count_total: timberEdgeRafterCountTotal,
    timber_common_rafter_count_per_plane: timberCommonRafterCountPerPlane,
    timber_common_rafter_count_total: timberCommonRafterCountTotal,
    timber_run_per_plane_m: timberRunPerPlaneM,
    timber_slope_len_per_plane_m: timberSlopeLenPerPlaneM,
    timber_purlin_lines_per_plane: timberPurlinLinesPerPlane,
    timber_purlin_total_m: timberPurlinTotalM,
    timber_hidden_finish: timberHiddenFinish,
    roof_slope_area_m2: roofSlopeAreaM2,
    timber_roof_above_area_m2: timberRoofAboveAreaM2,
    timber_insulated_panel_count_per_plane: timberInsulatedPanelCountPerPlane,
    timber_insulated_panel_count_total: timberInsulatedPanelCountTotal,
    timber_tray_sheet_count_per_plane: timberTraySheetCountPerPlane,
    timber_tray_sheet_count_total: timberTraySheetCountTotal,
    covertek_area_m2: covertekAreaM2,
    polystyrene_area_m2: polystyreneAreaM2,
    timber_roofing_screws_steel_count: timberRoofingScrewsSteelCount,
    timber_roofing_screws_insulated_count: timberRoofingScrewsInsulatedCount,
    roof_plane_count: roofPlaneCount,
    total_rafter_pieces: totalRafterPieces,
    total_installed_rafter_length_m: totalInstalledRafterLengthM,
    joiner_runs_total: joinerRunsTotal,
    flashing_0_200_total_m: flashingTotalsByBand[FLASHING_BAND_0_200],
    flashing_201_300_total_m: flashingTotalsByBand[FLASHING_BAND_201_300],
    flashing_301_400_total_m: flashingTotalsByBand[FLASHING_BAND_301_400],
    flashing_total_m: flashingLengthM,
    flashing_startup_count: flashingStartupCount,
    acrylic_plane_count_used: acrylicPlaneCountUsed,
    gable_end_frame_count: gableEndFrameCount,
    tie_beam_length_m: tieBeamLengthM,
    kingpost_strut_length_m: kingpostStrutLengthM,
    powdercoat_colour_used: powdercoatColourUsed,
    powdercoat_multiplier: powdercoatMultiplier,
    gutter_length_m: gutterLengthM,
    downpipe_join_count_used: downpipeJoinCountUsed,
    downpipe_elbow_count_used: downpipeElbowCountUsed,
    roof_planes: roofPlanes,
    ...(typeof acrylicBaysTotal === 'number' ? { acrylic_bays_total: acrylicBaysTotal } : null),
    hip_rafter_count: hipRafterCount,
    ...(structureType === 'box_perimeter' ? { box_perimeter_m: 2 * (lengthM + projectionM), box_corner_count: 4 } : null),
  };

  return {
    inputs_normalized: inputsNormalized,
    derived,
    notes_and_warnings: warnings,
  };
}

export function applyGst(exGst: number): number {
  if (!Number.isFinite(exGst)) return 0;
  return exGst * (1 + GST_RATE);
}
