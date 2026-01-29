import {
  type CostInputsV1,
  type DerivedV1,
  type GroundCondition,
  type InputsNormalizedV1,
  type MixedRoofMode,
  type MixedRoofNormalizedV1,
  type PergolaStyleUi,
  type RafterProfile,
  type RoofType,
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
const BRACKET_SPACING_MM_MAX = 1500;
const STRINGER_FIXING_SPACING_MM = 1500;

const RAFTER_HOUSE_SETBACK_M = 0.05;
const RAFTER_GUTTER_SETBACK_M = 0.1;
const JOINER_EXTRA_M = 0.02;

const DEFAULT_ACRYLIC_SHEET_LENGTH_M = 3.05;
const DEFAULT_ACRYLIC_SHEET_WIDTH_M = 2.03;
const MIXED_ACRYLIC_BAY_WIDTH_M = 0.62;

export type DerivedResultV1 = {
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

function toPositiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toNonNegativeNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizePergolaStyle(style: PergolaStyleUi): { style: PergolaStyleUi; warnings: string[] } {
  return { style, warnings: [] };
}

function pickStructureType(style: PergolaStyleUi, boxEnabled: boolean | undefined): StructureType {
  if (style === 'box_perimeter') return 'box_perimeter';
  return boxEnabled ? 'box_perimeter' : 'pitched';
}

function pickRoofType(style: PergolaStyleUi, structureType: StructureType, roofType: RoofType | undefined): RoofType {
  if (structureType === 'box_perimeter') return roofType ?? DEFAULT_ROOF_TYPE;
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

function rafterDepthM(profile: RafterProfile): number {
  if (profile === '80x50') return 0.08;
  if (profile === '100x50') return 0.1;
  return 0.15;
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

    let acrylicAreaM2 = 0;
    let timberAreaM2 = 0;
    let acrylicBaysTotal = 0;
    let acrylicPlaneCountUsed = 0;

    const clampedByPlane: Record<string, number> = {};

    for (const plane of opts.roofPlanes) {
      const rawValue = byPlane[plane.id];
      const parsed =
        typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string'
            ? Number.parseInt(rawValue, 10)
            : NaN;
      const requested = Number.isFinite(parsed) ? Math.round(parsed) : plane.bay_count;
      const clamped = Math.max(0, Math.min(plane.bay_count, requested));
      clampedByPlane[plane.id] = clamped;

      if (requested > plane.bay_count) {
        warnings.push(`Mixed roof acrylic bays exceed bay count for ${plane.label}; clamping to ${plane.bay_count}.`);
      }

      if (Number.isFinite(plane.rafter_length_m) && plane.rafter_length_m > 6 + 1e-6 && clamped > 0) {
        warnings.push('Acrylic slope exceeds 6.0m max.');
      }

      const acrylicAreaPlane = clamped * MIXED_ACRYLIC_BAY_WIDTH_M * Math.max(0, plane.rafter_length_m);
      const timberAreaPlane = Math.max(0, Math.max(0, plane.roof_area_m2) - acrylicAreaPlane);

      acrylicAreaM2 += acrylicAreaPlane;
      timberAreaM2 += timberAreaPlane;
      acrylicBaysTotal += clamped;
      if (clamped > 0) acrylicPlaneCountUsed += 1;
    }

    return {
      normalized: {
        mode: 'acrylic_bays',
        ridge_skylight: null,
        acrylic_area_m2_override: null,
        acrylic_bays_by_plane: clampedByPlane,
      },
      acrylicAreaM2,
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

    return {
      normalized: {
        mode: 'area_override',
        ridge_skylight: null,
        acrylic_area_m2_override: override,
        acrylic_bays_by_plane: null,
      },
      acrylicAreaM2: clamped,
      timberAreaM2: Math.max(0, opts.roofSurfaceAreaM2 - clamped),
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
    acrylicAreaM2: clamped,
    timberAreaM2: Math.max(0, opts.roofSurfaceAreaM2 - clamped),
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

  const styleNormalized = normalizePergolaStyle(inputs.pergola_style);
  warnings.push(...styleNormalized.warnings);

  const structureType = pickStructureType(styleNormalized.style, inputs.box_perimeter_enabled);
  const roofType = pickRoofType(styleNormalized.style, structureType, inputs.internal_roof_type);

  const fallDistanceMmRaw =
    typeof inputs.fall_distance_mm === 'number' ? inputs.fall_distance_mm : Number.parseFloat(String(inputs.fall_distance_mm ?? ''));
  const fallDistanceMm =
    structureType === 'box_perimeter' ? (Number.isFinite(fallDistanceMmRaw) && fallDistanceMmRaw > 0 ? fallDistanceMmRaw : 0) : null;
  if (structureType === 'box_perimeter' && (!Number.isFinite(fallDistanceMmRaw) || fallDistanceMmRaw <= 0)) {
    warnings.push('Box perimeter fall distance (mm) is required for v1; using 0 for now.');
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
  const { profile: rafterProfile, warnings: profileWarnings } =
    structureType === 'box_perimeter' ? { profile: '80x50' as const, warnings: [] } : pickRafterProfile(effectiveSpanM);
  warnings.push(...profileWarnings);

  const lengthMmA = Math.round(lengthM * 1000);
  const lengthMmB = Math.round(hipCornerLengthBM * 1000);

  const rafterCountA = Math.ceil(lengthMmA / RAFTER_SPACING_MM_MAX) + 1;
  const rafterCountB = roofType === 'hip_corner' && hipCornerLengthBM > 0 ? Math.ceil(lengthMmB / RAFTER_SPACING_MM_MAX) + 1 : 0;
  const bayCountA = Math.max(0, rafterCountA - 1);
  const bayCountB = roofType === 'hip_corner' ? Math.max(0, rafterCountB - 1) : 0;

  const bracketCountA = inputs.house_connection_type === 'soffit' ? Math.ceil(lengthMmA / BRACKET_SPACING_MM_MAX) + 1 : 0;
  const bracketCountB =
    roofType === 'hip_corner' && inputs.house_connection_type === 'soffit'
      ? hipCornerLengthBM > 0
        ? Math.ceil(lengthMmB / BRACKET_SPACING_MM_MAX) + 1
        : 0
      : 0;

  const stringerFixingCountA =
    inputs.house_connection_type === 'fascia' || inputs.house_connection_type === 'facade'
      ? Math.ceil(lengthMmA / STRINGER_FIXING_SPACING_MM) + 1
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

  const areaM2 = roofType === 'hip_corner' ? lengthM * projectionM + hipCornerLengthBM * hipCornerProjectionBM : lengthM * projectionM;

  const pitchDefaults = (config?.rules as any)?.geometry?.roof_pitch_defaults_deg as Record<string, number> | undefined;
  const defaultPitchRaw = Number(
    pitchDefaults?.[roofType] ??
      (roofType === 'low_gable' ? 10 : roofType === 'gable' || roofType === 'hip' || roofType === 'hip_corner' ? 25 : 5),
  );
  const defaultPitch = Number.isFinite(defaultPitchRaw) ? defaultPitchRaw : 5;
  const roofPitchDegUsed = roofPitchDeg ?? defaultPitch;

  const effectiveCos = Math.max(0.02, cosDeg(roofPitchDegUsed));
  if (effectiveCos <= 0.021) warnings.push('Roof pitch is very steep; clamping trig calculation for safety.');

  // Geometry semantics:
  // - `roofSpanM` (aka legacy `projection_m`) is the total eave-to-eave span.
  // - For gable/low_gable/hip, each roof plane span is half that (`roofSpanM / 2`).
  // - `cutRafterLengthM` is based on the effective run (house + gutter setbacks removed).
  // - `joinerPieceLengthM` and `acrylicRequiredDownslopeM` add the 20mm joiner allowance only.
  const rafterRunM =
    roofType === 'hip_corner' ? Math.max(projectionM, hipCornerProjectionBM) : roofType === 'pitched' ? projectionM : projectionM / 2;
  const rafterLengthM = rafterRunM / effectiveCos;
  const roofSurfaceAreaM2 = areaM2 / effectiveCos;
  const rafterLengthMAssumed = rafterLengthM;

  const effectiveRunM = Math.max(0, rafterRunM - (RAFTER_HOUSE_SETBACK_M + RAFTER_GUTTER_SETBACK_M));
  const cutRafterLengthM = effectiveRunM / effectiveCos;
  const angleCutAllowanceM = rafterDepthM(rafterProfile) * tanDeg(roofPitchDegUsed);
  const joinerPieceLengthM = cutRafterLengthM + JOINER_EXTRA_M;
  const acrylicRequiredDownslopeM = joinerPieceLengthM;
  const requiredDownslopeM = acrylicRequiredDownslopeM;

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
    warnings.push('Acrylic joiner system assumed (no through-fixing).');
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
    if (acrylicAreaM2 > 0) warnings.push('Acrylic joiner system assumed (no through-fixing).');
  }

  const acrylicSheetAreaM2 = DEFAULT_ACRYLIC_SHEET_LENGTH_M * DEFAULT_ACRYLIC_SHEET_WIDTH_M;
  const acrylicSheetCount =
    inputs.roof_material === 'acrylic' || inputs.roof_material === 'mixed'
      ? Math.max(0, Math.ceil(acrylicAreaM2 / acrylicSheetAreaM2))
      : 0;

  const coverageMultiplier = roofType === 'pitched' || roofType === 'hip_corner' ? 1 : roofPlaneCount;
  const baseLinearLength = roofType === 'hip_corner' ? lengthM + hipCornerLengthBM : lengthM;
  const flashingLengthM = baseLinearLength * coverageMultiplier;
  const foamLengthM = baseLinearLength * coverageMultiplier;

  const travel = toNonNegativeNumber(inputs.travel_ex_gst, 0);
  const extras = toNonNegativeNumber(inputs.extras_allowance_ex_gst, 0);

  const quoteDiscountPct = clampNumber(toNonNegativeNumber(inputs.quote_discount_pct, 0), 0, 80);

  const gutterLengthRaw = toNonNegativeNumber(inputs.gutter_length_m, NaN);
  const gutterLengthM = Number.isFinite(gutterLengthRaw) && gutterLengthRaw > 0 ? gutterLengthRaw : baseLinearLength;

  const timberAllowanceRaw = toNonNegativeNumber(inputs.timber_roof_allowance_ex_gst, 0);
  if (timberAllowanceRaw > 0) warnings.push('Timber roof allowance input is deprecated and ignored (timber roof is now a takeoff).');

  const inputsNormalized: InputsNormalizedV1 = {
    length_m: lengthM,
    projection_m: projectionM,
    hip_corner_length_b_m: roofType === 'hip_corner' ? hipCornerLengthBM : null,
    hip_corner_projection_b_m: roofType === 'hip_corner' ? hipCornerProjectionBM : null,
    post_cut_height_m: postCutHeightM,
    roof_pitch_deg: roofPitchDeg,

    structure_type: structureType,
    pergola_style_ui: styleNormalized.style,
    roof_material: inputs.roof_material,
    roof_type: roofType,
    extrusion_colour: inputs.extrusion_colour,
    mixed_roof: mixedRoofNormalized,

    post_count: postCount,
    house_connection_type: inputs.house_connection_type,
    post_connection_type: inputs.post_connection_type,
    access: inputs.access,
    height: inputs.height,
    ground,

    box_beam_profile: structureType === 'box_perimeter' ? '300x50' : null,
    fall_distance_mm: fallDistanceMm,
    gutter_length_m: gutterLengthM,

    rafter_profile: rafterProfile,
    gutter_type: structureType === 'pitched' ? 'sp_gutter' : structureType === 'box_perimeter' ? 'box_gutter_100x100x3' : null,
    acrylic_sheet_count: acrylicSheetCount,
    flashing_length_m: flashingLengthM,
    foam_length_m: foamLengthM,

    travel_ex_gst: travel,
    extras_allowance_ex_gst: extras,
    timber_roof_allowance_ex_gst: 0,

    quote_discount_pct: quoteDiscountPct,
  };

  const derived: DerivedResultV1['derived'] = {
    area_m2: areaM2,
    length_m: lengthM,
    projection_m: projectionM,
    roof_length_m: lengthM,
    roof_span_m: projectionM,
    roof_plane_span_m: rafterRunM,
    roof_plane_sloped_downslope_m: rafterLengthM,
    roof_area_total_m2: areaM2,
    module_count: 1,
    ...(roofType === 'hip_corner'
      ? {
          hip_corner_length_b_m: hipCornerLengthBM,
          hip_corner_projection_b_m: hipCornerProjectionBM,
          hip_corner_rafter_count_a: rafterCountA,
          hip_corner_rafter_count_b: rafterCountB,
        }
      : null),
    rafter_count: rafterCount,
    bracket_count: bracketCount,
    stringer_fixing_count: stringerFixingCount,
    bay_count: bayCount,
    rafter_profile_auto: rafterProfile,
    rafter_length_m_assumed: rafterLengthMAssumed,
    roof_pitch_deg_used: roofPitchDegUsed,
    rafter_run_m: rafterRunM,
    rafter_length_m: rafterLengthM,
    rafter_run_m_takeoff: effectiveRunM,
    rafter_cut_length_m: cutRafterLengthM,
    joiner_piece_length_m: joinerPieceLengthM,
    effective_run_m: effectiveRunM,
    required_downslope_m: requiredDownslopeM,
    cut_rafter_length_m: cutRafterLengthM,
    angle_cut_allowance_m: angleCutAllowanceM,
    acrylic_required_downslope_m: acrylicRequiredDownslopeM,
    roof_surface_area_m2: roofSurfaceAreaM2,
    ridge_length_m: ridgeLengthM,
    acrylic_area_m2: acrylicAreaM2,
    timber_area_m2: timberAreaM2,
    roof_plane_count: roofPlaneCount,
    total_rafter_pieces: roofType === 'low_gable' || roofType === 'gable' || roofType === 'hip' ? rafterCount * 2 : rafterCount,
    joiner_runs_total: roofType === 'low_gable' || roofType === 'gable' || roofType === 'hip' ? rafterCount * 2 : rafterCount,
    acrylic_plane_count_used: acrylicPlaneCountUsed,
    gutter_length_m: gutterLengthM,
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
