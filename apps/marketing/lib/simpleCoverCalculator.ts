import {
  calculateAcrylicRafterLayoutV1,
  type SiteInputsV1,
} from '@sp/costing';
import { buildEnquiryHref } from './enquiryContext';

export const SIMPLE_COVER_WIDTH_MIN_MM = 1_000;
export const SIMPLE_COVER_WIDTH_MAX_MM = 10_000;
export const SIMPLE_COVER_PROJECTION_MIN_MM = 1_000;
export const SIMPLE_COVER_PROJECTION_MAX_MM = 6_000;
export const SIMPLE_COVER_INCREMENT_MM = 100;
export const SIMPLE_COVER_DEFAULT_WIDTH_MM = 6_000;
export const SIMPLE_COVER_DEFAULT_PROJECTION_MM = 3_000;
const SIMPLE_COVER_POST_HEIGHT_M = 2.4;
export const SIMPLE_COVER_MAX_POST_SPACING_MM = 4_000;
export const SIMPLE_COVER_GROUND_MAX_AREA_M2 = 30;
export const SIMPLE_COVER_ELEVATED_MAX_AREA_M2 = 20;
export const SIMPLE_COVER_LEDGER_WIDTH_MM = 50;
export const SIMPLE_COVER_RAFTER_WIDTH_MM = 50;
export const SIMPLE_COVER_FRONT_BEAM_WIDTH_MM = 100;
export const SIMPLE_COVER_POST_SIZE_MM = 100;
const SIMPLE_COVER_PATH = '/simple-cover-calculator';

export type SimpleCoverLevel = 'ground' | 'elevated';

export type SimpleCoverInput = {
  widthMm: number;
  projectionMm: number;
  level: SimpleCoverLevel;
};

export type SimpleCoverPlan = {
  postPositions: number[];
  rafterPositions: number[];
};

type SimpleCoverResultBase = {
  input: SimpleCoverInput;
  areaM2: number;
  postCount: number;
  postSpacingMm: number;
  plan: SimpleCoverPlan;
};

export type SimpleCoverPricedResult = SimpleCoverResultBase & {
  ok: true;
  status: 'priced';
  price: {
    fromIncGst: number;
    currency: 'NZD';
  };
  configuration: {
    versionNumber: number;
  };
};

export type SimpleCoverCustomResult = SimpleCoverResultBase & {
  ok: true;
  status: 'custom';
  reasonCode: 'ground_area_limit' | 'elevated_area_limit';
  reason: string;
  continuation: {
    href: string;
    label: string;
  };
};

export type SimpleCoverUnavailableResult = {
  ok: false;
  status: 'unavailable';
  message: string;
};

export type SimpleCoverInvalidResult = {
  ok: false;
  status: 'invalid';
  message: string;
};

export type SimpleCoverPublicResult =
  | SimpleCoverPricedResult
  | SimpleCoverCustomResult
  | SimpleCoverUnavailableResult
  | SimpleCoverInvalidResult;

function isSteppedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= min
    && value <= max
    && value % SIMPLE_COVER_INCREMENT_MM === 0;
}

export function parseSimpleCoverInput(value: unknown): SimpleCoverInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    !isSteppedInteger(input.widthMm, SIMPLE_COVER_WIDTH_MIN_MM, SIMPLE_COVER_WIDTH_MAX_MM)
    || !isSteppedInteger(input.projectionMm, SIMPLE_COVER_PROJECTION_MIN_MM, SIMPLE_COVER_PROJECTION_MAX_MM)
    || (input.level !== 'ground' && input.level !== 'elevated')
  ) {
    return null;
  }
  return {
    widthMm: input.widthMm,
    projectionMm: input.projectionMm,
    level: input.level,
  };
}

export function simpleCoverAreaM2(input: Pick<SimpleCoverInput, 'widthMm' | 'projectionMm'>): number {
  return Math.round((input.widthMm * input.projectionMm) / 10_000) / 100;
}

export function simpleCoverPostCount(widthMm: number): number {
  return Math.max(2, Math.ceil(widthMm / SIMPLE_COVER_MAX_POST_SPACING_MM) + 1);
}

export function simpleCoverRafterLayout(widthMm: number) {
  return calculateAcrylicRafterLayoutV1(widthMm);
}

function evenlySpacedMemberCentrePositions(widthMm: number, memberWidthMm: number, count: number): number[] {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  if (count === 1) return [0.5];
  const safeWidthMm = Number.isFinite(widthMm) ? Math.max(0, widthMm) : 0;
  if (safeWidthMm === 0) return Array.from({ length: count }, () => 0.5);
  const inset = Math.min(0.5, memberWidthMm / 2 / safeWidthMm);
  return Array.from(
    { length: count },
    (_, index) => inset + (index / (count - 1)) * (1 - inset * 2),
  );
}

export function buildSimpleCoverPlan(widthMm: number, postCount: number): SimpleCoverPlan {
  return {
    postPositions: evenlySpacedMemberCentrePositions(widthMm, SIMPLE_COVER_POST_SIZE_MM, postCount),
    rafterPositions: simpleCoverRafterLayout(widthMm).positions,
  };
}

function formatCustomArea(areaM2: number): string {
  return new Intl.NumberFormat('en-NZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(areaM2);
}

export function getSimpleCoverCustomResult(input: SimpleCoverInput): SimpleCoverCustomResult | null {
  const areaM2 = simpleCoverAreaM2(input);
  const maxAreaM2 = input.level === 'ground'
    ? SIMPLE_COVER_GROUND_MAX_AREA_M2
    : SIMPLE_COVER_ELEVATED_MAX_AREA_M2;
  if (areaM2 <= maxAreaM2) return null;

  const levelLabel = input.level === 'ground' ? 'ground-level' : 'elevated';
  const postCount = simpleCoverPostCount(input.widthMm);
  return {
    ok: true,
    status: 'custom',
    input,
    areaM2,
    postCount,
    postSpacingMm: Math.round(input.widthMm / (postCount - 1)),
    plan: buildSimpleCoverPlan(input.widthMm, postCount),
    reasonCode: input.level === 'ground' ? 'ground_area_limit' : 'elevated_area_limit',
    reason: `${formatCustomArea(areaM2)} m² exceeds the ${maxAreaM2} m² ${levelLabel} Simple cover limit.`,
    continuation: {
      href: buildEnquiryHref({
        enquiryType: 'residential',
        sourcePath: SIMPLE_COVER_PATH,
        sourceComponent: 'public_calculator',
      }),
      label: 'Discuss a custom design',
    },
  };
}

/** Final allow-list before a Simple cover result crosses the public API boundary. */
export function toCustomerSafeSimpleCoverResult(result: SimpleCoverPublicResult): SimpleCoverPublicResult {
  if (result.status === 'priced') {
    return {
      ok: true,
      status: 'priced',
      input: { ...result.input },
      areaM2: result.areaM2,
      postCount: result.postCount,
      postSpacingMm: result.postSpacingMm,
      plan: {
        postPositions: [...result.plan.postPositions],
        rafterPositions: [...result.plan.rafterPositions],
      },
      price: { ...result.price },
      configuration: { versionNumber: result.configuration.versionNumber },
    };
  }
  if (result.status === 'custom') {
    return {
      ok: true,
      status: 'custom',
      input: { ...result.input },
      areaM2: result.areaM2,
      postCount: result.postCount,
      postSpacingMm: result.postSpacingMm,
      plan: {
        postPositions: [...result.plan.postPositions],
        rafterPositions: [...result.plan.rafterPositions],
      },
      reasonCode: result.reasonCode,
      reason: result.reason,
      continuation: { ...result.continuation },
    };
  }
  return {
    ok: false,
    status: result.status,
    message: result.message,
  };
}

export function buildSimpleCoverSiteInputs(input: SimpleCoverInput): SiteInputsV1 {
  const widthM = input.widthMm / 1_000;
  const projectionM = input.projectionMm / 1_000;
  return {
    pergolas: [{
      id: 'pergola-1',
      label: 'Pergola 1',
      modules: [{
        length_m: widthM,
        roof_span_m: projectionM,
        post_cut_height_m: SIMPLE_COVER_POST_HEIGHT_M,
        post_count: simpleCoverPostCount(input.widthMm),
        pergola_style: 'pitched',
        roof_material: 'acrylic',
        extrusion_colour: 'Black',
        powdercoat_is_custom: false,
        box_perimeter_enabled: false,
        internal_roof_type: 'pitched',
        downpipe_count: 0,
        downpipe_join_count: 0,
        downpipe_elbow_count: 0,
        separate_gutter_enabled: false,
        overhang_enabled: false,
        inverted_enabled: false,
        flashings: {
          default_overrides: [{ key: 'pitched_primary', band: 'none' }],
          extras: [{ band: '201-300', length_m: widthM }],
        },
        overrides: {},
        house_connection_type: 'fascia',
        attachment_length_mm: input.widthMm,
        post_connection_type: 'deck_bracket',
        access: 'normal',
        height: input.level === 'ground' ? 'single_storey' : 'two_storey',
        ground: 'easy',
        travel_ex_gst: 0,
        extras_allowance_ex_gst: 0,
        quote_discount_pct: 0,
        infills: [],
      }],
    }],
    job_type: 'residential',
    travel_ex_gst: 0,
    extras_allowance_ex_gst: 0,
    quote_discount_pct: 0,
  };
}
