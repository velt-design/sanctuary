import { getPortalSession } from '@/lib/auth';
import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { calculateJobCostV1 } from '@sp/costing';
import type { CostInputsV1, ExtrusionColour, JobInputsV1 } from '@sp/costing';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PERGOLA_STYLES = ['pitched', 'gable', 'hip', 'hip_corner', 'box_perimeter'] as const;
const ROOF_MATERIALS = ['acrylic', 'timber', 'mixed'] as const;
const TIMBER_ROOF_ABOVE_TYPES = ['insulated_panels', 'steel_corrugated', 'steel_tray'] as const;
const TIMBER_TRAY_WIDTHS = [400, 500, 600] as const;
const MIXED_ROOF_MODES = ['ridge_skylight', 'area_override', 'acrylic_bays'] as const;
const EXTRUSION_COLOURS: ExtrusionColour[] = ['Black', 'White', 'Mill'];
const GABLE_END_FRAMES = ['none', 'outer_end_only', 'both_ends'] as const;
const HOUSE_CONNECTIONS = ['soffit', 'fascia', 'facade', 'none'] as const;
const POST_CONNECTIONS = ['pile_1m', 'pile_1_5m', 'deck_bracket', 'slab_anchors'] as const;
const ACCESS_LEVELS = ['easy', 'normal', 'hard'] as const;
const HEIGHT_CATEGORIES = ['single_storey', 'two_storey'] as const;
const GROUND_CONDITIONS = ['easy', 'hard'] as const;
const ROOF_TYPES = ['pitched', 'low_gable', 'gable'] as const;
const BOX_GUTTER_EDGES = ['house', 'our', 'none'] as const;
const GABLE_GUTTER_EDGES = ['house', 'our'] as const;
const OVERHANG_SUPPORT_BEAM_PROFILES = ['150x50', '200x50'] as const;
const POWDERCOAT_STANDARD_COLOURS = [
  'Ironsands',
  'Charcoal',
  'Grey Friars',
  'Flaxpod',
  'Rangoon Green',
  'Gull Grey',
  'Titania',
] as const;

function isOneOf<const T extends readonly string[]>(allowed: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : NaN;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseModule(raw: any): CostInputsV1 | { error: string } {
  const length_m = toNumber(raw.length_m);
  const roof_span_m_raw = raw.roof_span_m;
  const projection_m_raw = raw.projection_m;
  const roof_span_m = roof_span_m_raw !== undefined ? toNumber(roof_span_m_raw) : NaN;
  const projection_m = projection_m_raw !== undefined ? toNumber(projection_m_raw) : NaN;
  const roof_pitch_deg = raw.roof_pitch_deg !== undefined ? toNumber(raw.roof_pitch_deg) : undefined;
  const gutter_length_m = raw.gutter_length_m !== undefined ? toNumber(raw.gutter_length_m) : undefined;
    const downpipe_count = raw.downpipe_count !== undefined ? toNumber(raw.downpipe_count) : undefined;
    const downpipe_join_count = raw.downpipe_join_count !== undefined ? toNumber(raw.downpipe_join_count) : undefined;
    const downpipe_elbow_count = raw.downpipe_elbow_count !== undefined ? toNumber(raw.downpipe_elbow_count) : undefined;
  const overhang_amount_m = raw.overhang_amount_m !== undefined ? toNumber(raw.overhang_amount_m) : undefined;

  if (!Number.isFinite(length_m) || length_m <= 0) return { error: 'modules[].length_m must be a number > 0' };
  if (roof_span_m_raw === undefined && projection_m_raw === undefined) {
    return { error: 'modules[].roof_span_m must be a number > 0 (projection_m accepted for legacy payloads)' };
  }
  if (roof_span_m_raw !== undefined && (!Number.isFinite(roof_span_m) || roof_span_m <= 0)) {
    return { error: 'modules[].roof_span_m must be a number > 0' };
  }
  if (roof_span_m_raw === undefined && (!Number.isFinite(projection_m) || projection_m <= 0)) {
    return { error: 'modules[].projection_m must be a number > 0' };
  }
  if (roof_span_m_raw !== undefined && projection_m_raw !== undefined && Math.abs(roof_span_m - projection_m) > 1e-6) {
    return { error: 'modules[].roof_span_m and modules[].projection_m differ; provide only one (or make them equal)' };
  }
  if (roof_pitch_deg !== undefined && (!Number.isFinite(roof_pitch_deg) || roof_pitch_deg < 0 || roof_pitch_deg > 85)) {
    return { error: 'modules[].roof_pitch_deg must be a number between 0 and 85' };
  }
  if (gutter_length_m !== undefined && (!Number.isFinite(gutter_length_m) || gutter_length_m < 0)) {
    return { error: 'modules[].gutter_length_m must be a number >= 0' };
  }
    if (downpipe_count !== undefined && (!Number.isFinite(downpipe_count) || downpipe_count < 0)) {
      return { error: 'modules[].downpipe_count must be a number >= 0' };
    }
    if (downpipe_join_count !== undefined && (!Number.isFinite(downpipe_join_count) || downpipe_join_count < 0)) {
      return { error: 'modules[].downpipe_join_count must be a number >= 0' };
    }
    if (downpipe_elbow_count !== undefined && (!Number.isFinite(downpipe_elbow_count) || downpipe_elbow_count < 0)) {
      return { error: 'modules[].downpipe_elbow_count must be a number >= 0' };
    }
  if (overhang_amount_m !== undefined && (!Number.isFinite(overhang_amount_m) || overhang_amount_m < 0 || overhang_amount_m > 1.5)) {
    return { error: 'modules[].overhang_amount_m must be a number between 0 and 1.5' };
  }

  if (!isOneOf(PERGOLA_STYLES, raw.pergola_style)) return { error: 'Invalid modules[].pergola_style' };
  if (!isOneOf(ROOF_MATERIALS, raw.roof_material)) return { error: 'Invalid modules[].roof_material' };
  if (raw.timber_roof_above_type !== undefined && !isOneOf(TIMBER_ROOF_ABOVE_TYPES, raw.timber_roof_above_type)) {
    return { error: 'Invalid modules[].timber_roof_above_type' };
  }
  if (raw.timber_insulated_panel_thickness_mm !== undefined) {
    const thickness = toNumber(raw.timber_insulated_panel_thickness_mm);
    if (!Number.isFinite(thickness) || thickness <= 0) {
      return { error: 'modules[].timber_insulated_panel_thickness_mm must be a number > 0' };
    }
  }
  if (raw.timber_tray_width_mm !== undefined) {
    const trayWidth = toNumber(raw.timber_tray_width_mm);
    if (!Number.isFinite(trayWidth) || !TIMBER_TRAY_WIDTHS.includes(Math.round(trayWidth) as any)) {
      return { error: 'modules[].timber_tray_width_mm must be one of 400, 500, 600' };
    }
  }
  if (!EXTRUSION_COLOURS.includes(raw.extrusion_colour)) return { error: 'Invalid modules[].extrusion_colour' };
  if (raw.gable_end_frames_mode !== undefined && !isOneOf(GABLE_END_FRAMES, raw.gable_end_frames_mode)) {
    return { error: 'Invalid modules[].gable_end_frames_mode' };
  }
  if (!isOneOf(HOUSE_CONNECTIONS, raw.house_connection_type)) return { error: 'Invalid modules[].house_connection_type' };
  if (!isOneOf(POST_CONNECTIONS, raw.post_connection_type)) return { error: 'Invalid modules[].post_connection_type' };
  if (!isOneOf(ACCESS_LEVELS, raw.access)) return { error: 'Invalid modules[].access' };
  if (!isOneOf(HEIGHT_CATEGORIES, raw.height)) return { error: 'Invalid modules[].height' };

  if (raw.ground !== undefined && !isOneOf(GROUND_CONDITIONS, raw.ground)) return { error: 'Invalid modules[].ground' };
  if (raw.internal_roof_type !== undefined && !isOneOf(ROOF_TYPES, raw.internal_roof_type)) {
    return { error: 'Invalid modules[].internal_roof_type' };
  }
  if (raw.box_gutter_house_edge !== undefined && !isOneOf(BOX_GUTTER_EDGES, raw.box_gutter_house_edge)) {
    return { error: 'Invalid modules[].box_gutter_house_edge' };
  }
  if (raw.box_gutter_far_edge !== undefined && !isOneOf(BOX_GUTTER_EDGES, raw.box_gutter_far_edge)) {
    return { error: 'Invalid modules[].box_gutter_far_edge' };
  }
  if (raw.gable_house_edge_gutter !== undefined && !isOneOf(GABLE_GUTTER_EDGES, raw.gable_house_edge_gutter)) {
    return { error: 'Invalid modules[].gable_house_edge_gutter' };
  }
  if (raw.gable_outer_edge_gutter !== undefined && !isOneOf(GABLE_GUTTER_EDGES, raw.gable_outer_edge_gutter)) {
    return { error: 'Invalid modules[].gable_outer_edge_gutter' };
  }
  if (raw.overhang_enabled !== undefined && typeof raw.overhang_enabled !== 'boolean') {
    return { error: 'modules[].overhang_enabled must be a boolean' };
  }
  if (raw.inverted_enabled !== undefined && typeof raw.inverted_enabled !== 'boolean') {
    return { error: 'modules[].inverted_enabled must be a boolean' };
  }
  if (raw.inverted_house_gutter !== undefined && typeof raw.inverted_house_gutter !== 'boolean') {
    return { error: 'modules[].inverted_house_gutter must be a boolean' };
  }
  if (raw.overhang_support_beam_profile !== undefined && !isOneOf(OVERHANG_SUPPORT_BEAM_PROFILES, raw.overhang_support_beam_profile)) {
    return { error: 'Invalid modules[].overhang_support_beam_profile' };
  }
  if (
    raw.powdercoat_standard_colour !== undefined &&
    !isOneOf(POWDERCOAT_STANDARD_COLOURS, raw.powdercoat_standard_colour)
  ) {
    return { error: 'Invalid modules[].powdercoat_standard_colour' };
  }
  if (raw.powdercoat_is_custom !== undefined && typeof raw.powdercoat_is_custom !== 'boolean') {
    return { error: 'modules[].powdercoat_is_custom must be a boolean' };
  }
  if (raw.powdercoat_custom_colour !== undefined && typeof raw.powdercoat_custom_colour !== 'string') {
    return { error: 'modules[].powdercoat_custom_colour must be a string' };
  }
  if (raw.overhang_enabled === true && raw.box_perimeter_enabled === true) {
    return { error: 'Overhang cannot be used with modules[].box_perimeter_enabled' };
  }
  if (raw.inverted_enabled === true && (raw.pergola_style !== 'pitched' || raw.box_perimeter_enabled === true)) {
    return { error: 'Inverted option is only available for pitched roofs' };
  }
  if (raw.overhang_enabled === true) {
    const spanForGuard = roof_span_m_raw !== undefined ? roof_span_m : projection_m;
    if (Number.isFinite(spanForGuard) && overhang_amount_m !== undefined && overhang_amount_m >= spanForGuard) {
      return { error: 'modules[].overhang_amount_m must be less than roof_span_m' };
    }
  }

  let overrides: CostInputsV1['overrides'] | undefined;
  if (raw.overrides !== undefined) {
    if (typeof raw.overrides !== 'object' || raw.overrides === null) {
      return { error: 'modules[].overrides must be an object' };
    }
    const rawOverrides = raw.overrides as Record<string, unknown>;
    const next: CostInputsV1['overrides'] = {};
    const assign = (key: keyof NonNullable<CostInputsV1['overrides']>) => {
      if (rawOverrides[key] === undefined) return;
      if (typeof rawOverrides[key] !== 'string') {
        throw new Error(`Invalid modules[].overrides.${key}`);
      }
      (next as any)[key] = rawOverrides[key] as string;
    };
    try {
      assign('ledger_profile');
      assign('rafter_profile');
      assign('post_profile');
      assign('front_beam_profile');
      assign('ridge_beam_profile');
      assign('box_perimeter_beam_profile');
      assign('overhang_support_beam_profile');
      assign('tie_beam_profile');
      assign('strut_profile');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid modules[].overrides';
      return { error: msg };
    }
    if (Object.keys(next).length > 0) overrides = next;
  }

  let mixed_roof: CostInputsV1['mixed_roof'] | undefined;
  if (raw.roof_material === 'mixed') {
    if (raw.mixed_roof !== undefined && (typeof raw.mixed_roof !== 'object' || raw.mixed_roof === null)) {
      return { error: 'modules[].mixed_roof must be an object' };
    }

    const mixedBody = (raw.mixed_roof ?? {}) as any;
    if (mixedBody.mode !== undefined && !isOneOf(MIXED_ROOF_MODES, mixedBody.mode)) return { error: 'Invalid modules[].mixed_roof.mode' };

    const inferredMode =
      mixedBody.mode === 'acrylic_bays' || (mixedBody.acrylic_bays_by_plane && typeof mixedBody.acrylic_bays_by_plane === 'object')
        ? 'acrylic_bays'
        : mixedBody.mode === 'area_override'
          ? 'area_override'
          : 'ridge_skylight';

    if (inferredMode === 'area_override') {
      if (raw.pergola_style === 'hip_corner') {
        return { error: 'modules[].mixed_roof.area_override is not supported for hip_corner; use acrylic_bays or ridge_skylight' };
      }
      const acrylic_area_m2 = mixedBody.acrylic_area_m2 !== undefined ? toNumber(mixedBody.acrylic_area_m2) : undefined;
      if (acrylic_area_m2 !== undefined && (!Number.isFinite(acrylic_area_m2) || acrylic_area_m2 < 0)) {
        return { error: 'modules[].mixed_roof.acrylic_area_m2 must be a number >= 0' };
      }
      mixed_roof = {
        mode: 'area_override',
        acrylic_area_m2,
      };
    } else if (inferredMode === 'acrylic_bays') {
      const rawBays = mixedBody.acrylic_bays_by_plane;
      if (rawBays === undefined || typeof rawBays !== 'object' || rawBays === null) {
        return { error: 'modules[].mixed_roof.acrylic_bays_by_plane must be an object' };
      }
      const parsed: Record<string, number> = {};
      for (const [key, value] of Object.entries(rawBays as Record<string, unknown>)) {
        const n = toNumber(value);
        if (!Number.isFinite(n) || n < 0) {
          return { error: 'modules[].mixed_roof.acrylic_bays_by_plane values must be numbers >= 0' };
        }
        parsed[key] = Math.round(n);
      }
      mixed_roof = {
        mode: 'acrylic_bays',
        acrylic_bays_by_plane: parsed,
      };
    } else {
      const ridge = mixedBody.ridge_skylight as any;
      if (ridge !== undefined && (typeof ridge !== 'object' || ridge === null)) return { error: 'modules[].mixed_roof.ridge_skylight must be an object' };

      const strip_count = ridge?.strip_count !== undefined ? toNumber(ridge.strip_count) : undefined;
      if (strip_count !== undefined && (!Number.isFinite(strip_count) || strip_count <= 0)) {
        return { error: 'modules[].mixed_roof.ridge_skylight.strip_count must be a number > 0' };
      }

      const strip_width_m = ridge?.strip_width_m !== undefined ? toNumber(ridge.strip_width_m) : undefined;
      if (strip_width_m !== undefined && (!Number.isFinite(strip_width_m) || strip_width_m <= 0)) {
        return { error: 'modules[].mixed_roof.ridge_skylight.strip_width_m must be a number > 0' };
      }

      mixed_roof = {
        mode: 'ridge_skylight',
        ridge_skylight: {
          strip_count: strip_count !== undefined ? Math.round(strip_count) : undefined,
          strip_width_m,
        },
      };
    }
  }

  let hip_corner: CostInputsV1['hip_corner'] | undefined;
  if (raw.pergola_style === 'hip_corner') {
    if (raw.hip_corner === undefined || typeof raw.hip_corner !== 'object' || raw.hip_corner === null) {
      return { error: 'modules[].hip_corner must be an object when pergola_style is hip_corner' };
    }
    const length_b_m = raw.hip_corner.length_b_m !== undefined ? toNumber(raw.hip_corner.length_b_m) : undefined;
    const projection_b_m = raw.hip_corner.projection_b_m !== undefined ? toNumber(raw.hip_corner.projection_b_m) : undefined;
    if (length_b_m === undefined || !Number.isFinite(length_b_m) || length_b_m <= 0) {
      return { error: 'modules[].hip_corner.length_b_m must be a number > 0' };
    }
    if (projection_b_m === undefined || !Number.isFinite(projection_b_m) || projection_b_m <= 0) {
      return { error: 'modules[].hip_corner.projection_b_m must be a number > 0' };
    }
    hip_corner = { length_b_m, projection_b_m };
  }

  const resolvedRoofSpanM = roof_span_m_raw !== undefined ? roof_span_m : projection_m;

  return {
    length_m,
    roof_span_m: resolvedRoofSpanM,
    post_cut_height_m: raw.post_cut_height_m !== undefined ? toNumber(raw.post_cut_height_m) : undefined,
    roof_pitch_deg,
    post_count: raw.post_count !== undefined ? toNumber(raw.post_count) : undefined,

    pergola_style: raw.pergola_style,
    box_perimeter_enabled: raw.box_perimeter_enabled === true,
    internal_roof_type: raw.internal_roof_type,
    fall_distance_mm: raw.fall_distance_mm !== undefined ? toNumber(raw.fall_distance_mm) : undefined,
    gutter_length_m,
    downpipe_count,
    downpipe_join_count,
    downpipe_elbow_count,
    box_gutter_house_edge: raw.box_gutter_house_edge,
    box_gutter_far_edge: raw.box_gutter_far_edge,
    gable_house_edge_gutter: raw.gable_house_edge_gutter,
    gable_outer_edge_gutter: raw.gable_outer_edge_gutter,
    overhang_enabled: raw.overhang_enabled === true,
    overhang_amount_m,
    overhang_support_beam_profile: raw.overhang_support_beam_profile,
    inverted_enabled: raw.inverted_enabled === true,
    inverted_house_gutter: raw.inverted_house_gutter === undefined ? undefined : raw.inverted_house_gutter === true,
    gable_end_frames_mode: raw.gable_end_frames_mode,

    roof_material: raw.roof_material,
    extrusion_colour: raw.extrusion_colour,
    timber_roof_above_type: raw.timber_roof_above_type,
    timber_insulated_panel_thickness_mm:
      raw.timber_insulated_panel_thickness_mm !== undefined ? toNumber(raw.timber_insulated_panel_thickness_mm) : undefined,
    timber_tray_width_mm: raw.timber_tray_width_mm !== undefined ? toNumber(raw.timber_tray_width_mm) : undefined,
    powdercoat_standard_colour: raw.powdercoat_standard_colour,
    powdercoat_is_custom: raw.powdercoat_is_custom === true,
    powdercoat_custom_colour: raw.powdercoat_custom_colour,
    mixed_roof,
    hip_corner,
    overrides,

    house_connection_type: raw.house_connection_type,
    post_connection_type: raw.post_connection_type,
    access: raw.access,
    height: raw.height,
    ground: raw.ground,

    // Job-level add-ons/discount handled at the job, not per module.
    travel_ex_gst: 0,
    extras_allowance_ex_gst: 0,
    timber_roof_allowance_ex_gst:
      raw.timber_roof_allowance_ex_gst !== undefined ? toNumber(raw.timber_roof_allowance_ex_gst) : undefined,
    quote_discount_pct: 0,
  };
}

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!Array.isArray(body?.modules) || body.modules.length === 0) return badRequest('modules must be a non-empty array');

  const modules: CostInputsV1[] = [];
  for (const raw of body.modules) {
    if (!raw || typeof raw !== 'object') return badRequest('Each module must be an object');
    const parsed = parseModule(raw);
    if ('error' in parsed) return badRequest(parsed.error);
    modules.push(parsed);
  }

  const job: JobInputsV1 = {
    modules,
    travel_ex_gst: body.travel_ex_gst !== undefined ? toNumber(body.travel_ex_gst) : undefined,
    extras_allowance_ex_gst: body.extras_allowance_ex_gst !== undefined ? toNumber(body.extras_allowance_ex_gst) : undefined,
    quote_discount_pct: body.quote_discount_pct !== undefined ? toNumber(body.quote_discount_pct) : undefined,
  };

  try {
    const { config } = await getCostingConfigWithOverrides();
    const result = calculateJobCostV1(job, config);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Costing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
