import { authOptions } from '@/lib/auth';
import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { calculateJobCostV1 } from '@/src/costing/engine/calculate';
import type { CostInputsV1, ExtrusionColour, JobInputsV1 } from '@/src/costing/engine/types';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PERGOLA_STYLES = ['pitched', 'gable', 'hip', 'hip_corner', 'box_perimeter'] as const;
const ROOF_MATERIALS = ['acrylic', 'timber', 'mixed'] as const;
const MIXED_ROOF_MODES = ['ridge_skylight', 'area_override'] as const;
const EXTRUSION_COLOURS: ExtrusionColour[] = ['Black', 'White', 'Mill'];
const HOUSE_CONNECTIONS = ['soffit', 'fascia', 'facade'] as const;
const POST_CONNECTIONS = ['pile_1m', 'pile_1_5m', 'deck_bracket', 'slab_anchors'] as const;
const ACCESS_LEVELS = ['easy', 'normal', 'hard'] as const;
const HEIGHT_CATEGORIES = ['single_storey', 'two_storey'] as const;
const GROUND_CONDITIONS = ['easy', 'hard'] as const;
const ROOF_TYPES = ['pitched', 'low_gable'] as const;

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
  const projection_m = toNumber(raw.projection_m);
  const roof_pitch_deg = raw.roof_pitch_deg !== undefined ? toNumber(raw.roof_pitch_deg) : undefined;

  if (!Number.isFinite(length_m) || length_m <= 0) return { error: 'modules[].length_m must be a number > 0' };
  if (!Number.isFinite(projection_m) || projection_m <= 0) return { error: 'modules[].projection_m must be a number > 0' };
  if (roof_pitch_deg !== undefined && (!Number.isFinite(roof_pitch_deg) || roof_pitch_deg < 0 || roof_pitch_deg > 85)) {
    return { error: 'modules[].roof_pitch_deg must be a number between 0 and 85' };
  }

  if (!isOneOf(PERGOLA_STYLES, raw.pergola_style)) return { error: 'Invalid modules[].pergola_style' };
  if (!isOneOf(ROOF_MATERIALS, raw.roof_material)) return { error: 'Invalid modules[].roof_material' };
  if (!EXTRUSION_COLOURS.includes(raw.extrusion_colour)) return { error: 'Invalid modules[].extrusion_colour' };
  if (!isOneOf(HOUSE_CONNECTIONS, raw.house_connection_type)) return { error: 'Invalid modules[].house_connection_type' };
  if (!isOneOf(POST_CONNECTIONS, raw.post_connection_type)) return { error: 'Invalid modules[].post_connection_type' };
  if (!isOneOf(ACCESS_LEVELS, raw.access)) return { error: 'Invalid modules[].access' };
  if (!isOneOf(HEIGHT_CATEGORIES, raw.height)) return { error: 'Invalid modules[].height' };

  if (raw.ground !== undefined && !isOneOf(GROUND_CONDITIONS, raw.ground)) return { error: 'Invalid modules[].ground' };
  if (raw.internal_roof_type !== undefined && !isOneOf(ROOF_TYPES, raw.internal_roof_type)) {
    return { error: 'Invalid modules[].internal_roof_type' };
  }

  let mixed_roof: CostInputsV1['mixed_roof'] | undefined;
  if (raw.roof_material === 'mixed') {
    if (raw.mixed_roof !== undefined && (typeof raw.mixed_roof !== 'object' || raw.mixed_roof === null)) {
      return { error: 'modules[].mixed_roof must be an object' };
    }

    const mixedBody = (raw.mixed_roof ?? {}) as any;
    if (mixedBody.mode !== undefined && !isOneOf(MIXED_ROOF_MODES, mixedBody.mode)) return { error: 'Invalid modules[].mixed_roof.mode' };

    if (mixedBody.mode === 'area_override') {
      const acrylic_area_m2 = mixedBody.acrylic_area_m2 !== undefined ? toNumber(mixedBody.acrylic_area_m2) : undefined;
      if (acrylic_area_m2 !== undefined && (!Number.isFinite(acrylic_area_m2) || acrylic_area_m2 < 0)) {
        return { error: 'modules[].mixed_roof.acrylic_area_m2 must be a number >= 0' };
      }
      mixed_roof = {
        mode: 'area_override',
        acrylic_area_m2,
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

  return {
    length_m,
    projection_m,
    post_cut_height_m: raw.post_cut_height_m !== undefined ? toNumber(raw.post_cut_height_m) : undefined,
    roof_pitch_deg,
    post_count: raw.post_count !== undefined ? toNumber(raw.post_count) : undefined,

    pergola_style: raw.pergola_style,
    box_perimeter_enabled: raw.box_perimeter_enabled === true,
    internal_roof_type: raw.internal_roof_type,
    fall_distance_mm: raw.fall_distance_mm !== undefined ? toNumber(raw.fall_distance_mm) : undefined,

    roof_material: raw.roof_material,
    extrusion_colour: raw.extrusion_colour,
    mixed_roof,
    hip_corner,

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
  const session = await getServerSession(authOptions);
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
