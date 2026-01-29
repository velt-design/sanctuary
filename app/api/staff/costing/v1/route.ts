import { authOptions } from '@/lib/auth';
import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { calculateCostV1 } from '@/src/costing/engine/calculate';
import type { CostInputsV1, ExtrusionColour } from '@/src/costing/engine/types';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PERGOLA_STYLES = ['pitched', 'gable', 'hip', 'hip_corner', 'box_perimeter'] as const;
const ROOF_MATERIALS = ['acrylic', 'timber', 'mixed'] as const;
const MIXED_ROOF_MODES = ['ridge_skylight', 'area_override', 'acrylic_bays'] as const;
const EXTRUSION_COLOURS: ExtrusionColour[] = ['Black', 'White', 'Mill'];
const HOUSE_CONNECTIONS = ['soffit', 'fascia', 'facade', 'none'] as const;
const POST_CONNECTIONS = ['pile_1m', 'pile_1_5m', 'deck_bracket', 'slab_anchors'] as const;
const ACCESS_LEVELS = ['easy', 'normal', 'hard'] as const;
const HEIGHT_CATEGORIES = ['single_storey', 'two_storey'] as const;
const GROUND_CONDITIONS = ['easy', 'hard'] as const;
const ROOF_TYPES = ['pitched', 'low_gable', 'gable'] as const;
const BOX_GUTTER_EDGES = ['house', 'our', 'none'] as const;
const OVERHANG_SUPPORT_BEAM_PROFILES = ['150x50', '200x50'] as const;

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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const length_m = toNumber(body.length_m);
  const roof_span_m_raw = body.roof_span_m;
  const projection_m_raw = body.projection_m;
  const roof_span_m = roof_span_m_raw !== undefined ? toNumber(roof_span_m_raw) : NaN;
  const projection_m = projection_m_raw !== undefined ? toNumber(projection_m_raw) : NaN;
  const roof_pitch_deg = body.roof_pitch_deg !== undefined ? toNumber(body.roof_pitch_deg) : undefined;
  const gutter_length_m = body.gutter_length_m !== undefined ? toNumber(body.gutter_length_m) : undefined;
  const downpipe_count = body.downpipe_count !== undefined ? toNumber(body.downpipe_count) : undefined;
  const overhang_amount_m = body.overhang_amount_m !== undefined ? toNumber(body.overhang_amount_m) : undefined;

  if (!Number.isFinite(length_m) || length_m <= 0) return badRequest('length_m must be a number > 0');
  if (roof_span_m_raw === undefined && projection_m_raw === undefined) {
    return badRequest('roof_span_m must be a number > 0 (projection_m accepted for legacy payloads)');
  }
  if (roof_span_m_raw !== undefined && (!Number.isFinite(roof_span_m) || roof_span_m <= 0)) {
    return badRequest('roof_span_m must be a number > 0');
  }
  if (roof_span_m_raw === undefined && (!Number.isFinite(projection_m) || projection_m <= 0)) {
    return badRequest('projection_m must be a number > 0');
  }
  if (roof_span_m_raw !== undefined && projection_m_raw !== undefined && Math.abs(roof_span_m - projection_m) > 1e-6) {
    return badRequest('roof_span_m and projection_m differ; provide only one (or make them equal)');
  }
  if (roof_pitch_deg !== undefined && (!Number.isFinite(roof_pitch_deg) || roof_pitch_deg < 0 || roof_pitch_deg > 85)) {
    return badRequest('roof_pitch_deg must be a number between 0 and 85');
  }
  if (gutter_length_m !== undefined && (!Number.isFinite(gutter_length_m) || gutter_length_m < 0)) {
    return badRequest('gutter_length_m must be a number >= 0');
  }
  if (downpipe_count !== undefined && (!Number.isFinite(downpipe_count) || downpipe_count < 0)) {
    return badRequest('downpipe_count must be a number >= 0');
  }
  if (overhang_amount_m !== undefined && (!Number.isFinite(overhang_amount_m) || overhang_amount_m < 0 || overhang_amount_m > 1.5)) {
    return badRequest('overhang_amount_m must be a number between 0 and 1.5');
  }

  if (!isOneOf(PERGOLA_STYLES, body.pergola_style)) return badRequest('Invalid pergola_style');
  if (!isOneOf(ROOF_MATERIALS, body.roof_material)) return badRequest('Invalid roof_material');
  if (!EXTRUSION_COLOURS.includes(body.extrusion_colour)) return badRequest('Invalid extrusion_colour');
  if (!isOneOf(HOUSE_CONNECTIONS, body.house_connection_type)) return badRequest('Invalid house_connection_type');
  if (!isOneOf(POST_CONNECTIONS, body.post_connection_type)) return badRequest('Invalid post_connection_type');
  if (!isOneOf(ACCESS_LEVELS, body.access)) return badRequest('Invalid access');
  if (!isOneOf(HEIGHT_CATEGORIES, body.height)) return badRequest('Invalid height');

  if (body.ground !== undefined && !isOneOf(GROUND_CONDITIONS, body.ground)) return badRequest('Invalid ground');
  if (body.internal_roof_type !== undefined && !isOneOf(ROOF_TYPES, body.internal_roof_type)) return badRequest('Invalid internal_roof_type');
  if (body.box_gutter_house_edge !== undefined && !isOneOf(BOX_GUTTER_EDGES, body.box_gutter_house_edge)) {
    return badRequest('Invalid box_gutter_house_edge');
  }
  if (body.box_gutter_far_edge !== undefined && !isOneOf(BOX_GUTTER_EDGES, body.box_gutter_far_edge)) {
    return badRequest('Invalid box_gutter_far_edge');
  }
  if (body.overhang_enabled !== undefined && typeof body.overhang_enabled !== 'boolean') {
    return badRequest('overhang_enabled must be a boolean');
  }
  if (body.inverted_enabled !== undefined && typeof body.inverted_enabled !== 'boolean') {
    return badRequest('inverted_enabled must be a boolean');
  }
  if (body.inverted_house_gutter !== undefined && typeof body.inverted_house_gutter !== 'boolean') {
    return badRequest('inverted_house_gutter must be a boolean');
  }
  if (body.overhang_support_beam_profile !== undefined && !isOneOf(OVERHANG_SUPPORT_BEAM_PROFILES, body.overhang_support_beam_profile)) {
    return badRequest('Invalid overhang_support_beam_profile');
  }
  if (body.overhang_enabled === true && body.box_perimeter_enabled === true) {
    return badRequest('Overhang cannot be used with box_perimeter_enabled');
  }
  if (body.inverted_enabled === true && (body.pergola_style !== 'pitched' || body.box_perimeter_enabled === true)) {
    return badRequest('Inverted option is only available for pitched roofs');
  }

  let mixed_roof: CostInputsV1['mixed_roof'] | undefined;
  if (body.roof_material === 'mixed') {
    if (body.mixed_roof !== undefined && (typeof body.mixed_roof !== 'object' || body.mixed_roof === null)) {
      return badRequest('mixed_roof must be an object');
    }

    const mixedBody = (body.mixed_roof ?? {}) as any;
    if (mixedBody.mode !== undefined && !isOneOf(MIXED_ROOF_MODES, mixedBody.mode)) return badRequest('Invalid mixed_roof.mode');

    const inferredMode =
      mixedBody.mode === 'acrylic_bays' || (mixedBody.acrylic_bays_by_plane && typeof mixedBody.acrylic_bays_by_plane === 'object')
        ? 'acrylic_bays'
        : mixedBody.mode === 'area_override'
          ? 'area_override'
          : 'ridge_skylight';

    if (inferredMode === 'area_override') {
      if (body.pergola_style === 'hip_corner') {
        return badRequest('mixed_roof.area_override is not supported for hip_corner; use acrylic_bays or ridge_skylight');
      }
      const acrylic_area_m2 = mixedBody.acrylic_area_m2 !== undefined ? toNumber(mixedBody.acrylic_area_m2) : undefined;
      if (acrylic_area_m2 !== undefined && (!Number.isFinite(acrylic_area_m2) || acrylic_area_m2 < 0)) {
        return badRequest('mixed_roof.acrylic_area_m2 must be a number >= 0');
      }
      mixed_roof = {
        mode: 'area_override',
        acrylic_area_m2,
      };
    } else if (inferredMode === 'acrylic_bays') {
      const raw = mixedBody.acrylic_bays_by_plane;
      if (raw === undefined || typeof raw !== 'object' || raw === null) {
        return badRequest('mixed_roof.acrylic_bays_by_plane must be an object');
      }
      const parsed: Record<string, number> = {};
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const n = toNumber(value);
        if (!Number.isFinite(n) || n < 0) {
          return badRequest('mixed_roof.acrylic_bays_by_plane values must be numbers >= 0');
        }
        parsed[key] = Math.round(n);
      }
      mixed_roof = {
        mode: 'acrylic_bays',
        acrylic_bays_by_plane: parsed,
      };
    } else {
      const ridge = mixedBody.ridge_skylight as any;
      if (ridge !== undefined && (typeof ridge !== 'object' || ridge === null)) return badRequest('mixed_roof.ridge_skylight must be an object');

      const strip_count = ridge?.strip_count !== undefined ? toNumber(ridge.strip_count) : undefined;
      if (strip_count !== undefined && (!Number.isFinite(strip_count) || strip_count <= 0)) {
        return badRequest('mixed_roof.ridge_skylight.strip_count must be a number > 0');
      }

      const strip_width_m = ridge?.strip_width_m !== undefined ? toNumber(ridge.strip_width_m) : undefined;
      if (strip_width_m !== undefined && (!Number.isFinite(strip_width_m) || strip_width_m <= 0)) {
        return badRequest('mixed_roof.ridge_skylight.strip_width_m must be a number > 0');
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
  if (body.pergola_style === 'hip_corner') {
    if (body.hip_corner === undefined || typeof body.hip_corner !== 'object' || body.hip_corner === null) {
      return badRequest('hip_corner must be an object when pergola_style is hip_corner');
    }
    const length_b_m = body.hip_corner.length_b_m !== undefined ? toNumber(body.hip_corner.length_b_m) : undefined;
    const projection_b_m = body.hip_corner.projection_b_m !== undefined ? toNumber(body.hip_corner.projection_b_m) : undefined;
    if (length_b_m === undefined || !Number.isFinite(length_b_m) || length_b_m <= 0) {
      return badRequest('hip_corner.length_b_m must be a number > 0');
    }
    if (projection_b_m === undefined || !Number.isFinite(projection_b_m) || projection_b_m <= 0) {
      return badRequest('hip_corner.projection_b_m must be a number > 0');
    }
    hip_corner = { length_b_m, projection_b_m };
  }

  const resolvedRoofSpanM = roof_span_m_raw !== undefined ? roof_span_m : projection_m;

  const inputs: CostInputsV1 = {
    length_m,
    roof_span_m: resolvedRoofSpanM,
    post_cut_height_m: body.post_cut_height_m !== undefined ? toNumber(body.post_cut_height_m) : undefined,
    roof_pitch_deg,
    post_count: body.post_count !== undefined ? toNumber(body.post_count) : undefined,

    pergola_style: body.pergola_style,
    box_perimeter_enabled: body.box_perimeter_enabled === true,
    internal_roof_type: body.internal_roof_type,
    fall_distance_mm: body.fall_distance_mm !== undefined ? toNumber(body.fall_distance_mm) : undefined,
    gutter_length_m,
    downpipe_count,
    box_gutter_house_edge: body.box_gutter_house_edge,
    box_gutter_far_edge: body.box_gutter_far_edge,
    overhang_enabled: body.overhang_enabled === true,
    overhang_amount_m,
    overhang_support_beam_profile: body.overhang_support_beam_profile,
    inverted_enabled: body.inverted_enabled === true,
    inverted_house_gutter: body.inverted_house_gutter === undefined ? undefined : body.inverted_house_gutter === true,

    roof_material: body.roof_material,
    extrusion_colour: body.extrusion_colour,
    mixed_roof,
    hip_corner,

    house_connection_type: body.house_connection_type,
    post_connection_type: body.post_connection_type,
    access: body.access,
    height: body.height,
    ground: body.ground,

    travel_ex_gst: body.travel_ex_gst !== undefined ? toNumber(body.travel_ex_gst) : undefined,
    extras_allowance_ex_gst: body.extras_allowance_ex_gst !== undefined ? toNumber(body.extras_allowance_ex_gst) : undefined,
    timber_roof_allowance_ex_gst:
      body.timber_roof_allowance_ex_gst !== undefined ? toNumber(body.timber_roof_allowance_ex_gst) : undefined,
    quote_discount_pct: body.quote_discount_pct !== undefined ? toNumber(body.quote_discount_pct) : undefined,
  };

  try {
    const { config } = await getCostingConfigWithOverrides();
    const result = calculateCostV1(inputs, config);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Costing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
