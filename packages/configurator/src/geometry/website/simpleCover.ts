import { calculateAcrylicRafterLayoutV1, DEFAULT_PERGOLA_POST_SPACING_M, suggestPergolaPostCountV1, type SiteInputsV1 } from '@sp/costing';
export const SIMPLE_COVER_WIDTH_MIN_MM = 1_000;
export const SIMPLE_COVER_WIDTH_MAX_MM = 10_000;
export const SIMPLE_COVER_PROJECTION_MIN_MM = 1_000;
export const SIMPLE_COVER_PROJECTION_MAX_MM = 6_000;
export const SIMPLE_COVER_INCREMENT_MM = 100;
export const SIMPLE_COVER_DEFAULT_WIDTH_MM = 6_000;
export const SIMPLE_COVER_DEFAULT_PROJECTION_MM = 3_000;
const SIMPLE_COVER_POST_HEIGHT_M = 2.4;
export const SIMPLE_COVER_MAX_POST_SPACING_MM = DEFAULT_PERGOLA_POST_SPACING_M * 1_000;
export const SIMPLE_COVER_GROUND_MAX_AREA_M2 = 30;
export const SIMPLE_COVER_ELEVATED_MAX_AREA_M2 = 20;
export const SIMPLE_COVER_LEDGER_WIDTH_MM = 50;
export const SIMPLE_COVER_RAFTER_WIDTH_MM = 50;
export const SIMPLE_COVER_FRONT_BEAM_WIDTH_MM = 100;
export const SIMPLE_COVER_POST_SIZE_MM = 100;
export const SIMPLE_COVER_DEFAULT_CONNECTION = 'facade' as const;

export type SimpleCoverLevel = 'ground' | 'elevated';
export type SimpleCoverConnection = 'fascia' | 'facade' | 'soffit';

export const SIMPLE_COVER_CONNECTION_OPTIONS: ReadonlyArray<{
  value: SimpleCoverConnection;
  label: string;
}> = [
  { value: 'fascia', label: 'Fascia' },
  { value: 'facade', label: 'Facade' },
  { value: 'soffit', label: 'Soffit brackets' },
];

export type SimpleCoverInput = {
  widthMm: number;
  projectionMm: number;
  level: SimpleCoverLevel;
  connection: SimpleCoverConnection;
};

export type SimpleCoverPlan = {
  postPositions: number[];
  rafterPositions: number[];
};

export function simpleCoverAreaM2(input: Pick<SimpleCoverInput, 'widthMm' | 'projectionMm'>): number {
  return Math.round((input.widthMm * input.projectionMm) / 10_000) / 100;
}

export function simpleCoverPostCount(widthMm: number): number {
  return suggestPergolaPostCountV1(widthMm / 1_000, SIMPLE_COVER_DEFAULT_CONNECTION);
}

export function simpleCoverRafterLayout(widthMm: number) {
  return calculateAcrylicRafterLayoutV1(widthMm);
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
        house_connection_type: input.connection,
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
    pricing_classification: 'simple',
    approval_requirement: 'neither',
    travel_ex_gst: 0,
    extras_allowance_ex_gst: 0,
    quote_discount_pct: 0,
  };
}

/** Same customer policy message, without an application enquiry URL. */
export function getSimpleCoverCustomReason(input: SimpleCoverInput): string | undefined {
  const areaM2 = simpleCoverAreaM2(input);
  const maxAreaM2 = input.level === 'ground' ? SIMPLE_COVER_GROUND_MAX_AREA_M2 : SIMPLE_COVER_ELEVATED_MAX_AREA_M2;
  if (areaM2 <= maxAreaM2) return undefined;
  const area = new Intl.NumberFormat('en-NZ', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(areaM2);
  return `${area} m² exceeds the ${maxAreaM2} m² ${input.level === 'ground' ? 'ground-level' : 'elevated'} Simple cover limit.`;
}
