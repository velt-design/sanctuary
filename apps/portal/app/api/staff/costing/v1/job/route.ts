import { getPortalSession } from '@/lib/auth';
import { resolvePublishedCostingConfiguration } from '@/lib/costing/configurationResolver';
import { calculateSiteCostV1 } from '@sp/costing';
import type { CostInputsV1, ExtrusionColour, PergolaInputsV1, SiteInputsV1 } from '@sp/costing';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PERGOLA_STYLES = ['pitched', 'gable', 'hip', 'hip_corner', 'box_perimeter'] as const;
const ROOF_MATERIALS = ['acrylic', 'timber', 'mixed', 'none'] as const;
const TIMBER_ROOF_ABOVE_TYPES = ['insulated_panels', 'steel_corrugated', 'steel_tray'] as const;
const TIMBER_TRAY_WIDTHS = [400, 500, 600] as const;
const MIXED_ROOF_MODES = ['ridge_skylight', 'area_override', 'acrylic_bays'] as const;
const FLASHING_BANDS = ['0-200', '201-300', '301-400'] as const;
const FLASHING_BANDS_OR_NONE = ['none', '0-200', '201-300', '301-400'] as const;
const EXTRUSION_COLOURS: ExtrusionColour[] = ['Black', 'White', 'Mill'];
const GABLE_END_FRAMES = ['none', 'outer_end_only', 'both_ends'] as const;
const HOUSE_CONNECTIONS = ['soffit', 'fascia', 'facade', 'none'] as const;
const POST_CONNECTIONS = ['pile_1m', 'pile_1_5m', 'deck_bracket', 'slab_anchors'] as const;
const ACCESS_LEVELS = ['easy', 'normal', 'hard'] as const;
const HEIGHT_CATEGORIES = ['single_storey', 'two_storey'] as const;
const JOB_TYPES = ['residential', 'commercial'] as const;
const PRICING_CLASSIFICATIONS = ['simple', 'bespoke'] as const;
const APPROVAL_REQUIREMENTS = ['neither', 'engineering_required', 'full_building_consent'] as const;
const GROUND_CONDITIONS = ['easy', 'hard'] as const;
const ROOF_TYPES = ['pitched', 'low_gable', 'gable'] as const;
const BOX_GUTTER_EDGES = ['house', 'our', 'none'] as const;
const GABLE_GUTTER_EDGES = ['house', 'our'] as const;
const OVERHANG_SUPPORT_BEAM_PROFILES = ['150x50', '200x50', 'RHS 150x50x3'] as const;
const INFILL_LOCATIONS = ['front', 'house', 'side', 'gable_end', 'wall', 'custom'] as const;
const INFILL_ACRYLIC_SOURCES = ['strip_620', 'sheet_panels'] as const;
const INFILL_PANEL_ORIENTATIONS = ['vertical', 'horizontal'] as const;
const INFILL_WIDTH_MODES = ['match_roof_rafters', 'target_width'] as const;
const INFILL_INTERNAL_SUPPORT_MODES = ['none', 'match_roof_rafters', 'center', 'custom'] as const;
const INFILL_SHAPE_TYPES = ['rect', 'mono_slope'] as const;
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

function parseInfills(raw: unknown): CostInputsV1['infills'] | { error: string } | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return { error: 'modules[].infills must be an array' };

  const out: NonNullable<CostInputsV1['infills']> = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') return { error: `modules[].infills[${i}] must be an object` };
    const infill = item as any;

    if (typeof infill.id !== 'string' || !infill.id.trim()) return { error: `modules[].infills[${i}].id must be a non-empty string` };

    const qty = infill.qty === undefined ? 1 : toNumber(infill.qty);
    if (!Number.isFinite(qty) || qty < 1) return { error: `modules[].infills[${i}].qty must be a number >= 1` };

    if (!isOneOf(INFILL_LOCATIONS, infill.location)) return { error: `Invalid modules[].infills[${i}].location` };
    if (!isOneOf(INFILL_ACRYLIC_SOURCES, infill.acrylic_source)) return { error: `Invalid modules[].infills[${i}].acrylic_source` };
    if (infill.panel_orientation !== undefined && !isOneOf(INFILL_PANEL_ORIENTATIONS, infill.panel_orientation)) {
      return { error: `Invalid modules[].infills[${i}].panel_orientation` };
    }
    if (!isOneOf(INFILL_WIDTH_MODES, infill.width_mode)) return { error: `Invalid modules[].infills[${i}].width_mode` };

    const maxPanelWidth = infill.max_panel_width_m === undefined ? 1.2 : toNumber(infill.max_panel_width_m);
    if (!Number.isFinite(maxPanelWidth) || maxPanelWidth <= 0 || maxPanelWidth > 1.2) {
      return { error: `modules[].infills[${i}].max_panel_width_m must be a number > 0 and <= 1.2` };
    }

    const targetPanelWidth = infill.target_panel_width_m === undefined ? undefined : toNumber(infill.target_panel_width_m);
    if (targetPanelWidth !== undefined && (!Number.isFinite(targetPanelWidth) || targetPanelWidth <= 0)) {
      return { error: `modules[].infills[${i}].target_panel_width_m must be a number > 0` };
    }

    if (!infill.support || typeof infill.support !== 'object') return { error: `modules[].infills[${i}].support must be an object` };
    const support = infill.support as any;

    const boolFields = ['has_top', 'has_bottom', 'has_left', 'has_right'] as const;
    for (const key of boolFields) {
      if (support[key] !== undefined && typeof support[key] !== 'boolean') {
        return { error: `modules[].infills[${i}].support.${key} must be a boolean` };
      }
    }

    if (support.internal_support_mode !== undefined && !isOneOf(INFILL_INTERNAL_SUPPORT_MODES, support.internal_support_mode)) {
      return { error: `Invalid modules[].infills[${i}].support.internal_support_mode` };
    }

    let internalPositions: number[] | undefined;
    if (support.internal_support_positions_m !== undefined) {
      if (!Array.isArray(support.internal_support_positions_m)) {
        return { error: `modules[].infills[${i}].support.internal_support_positions_m must be an array` };
      }
      internalPositions = [];
      for (const [idx, value] of support.internal_support_positions_m.entries()) {
        const n = toNumber(value);
        if (!Number.isFinite(n) || n < 0) return { error: `modules[].infills[${i}].support.internal_support_positions_m[${idx}] must be >= 0` };
        internalPositions.push(n);
      }
    }

    if (!infill.shape || typeof infill.shape !== 'object') return { error: `modules[].infills[${i}].shape must be an object` };
    const shape = infill.shape as any;
    if (!isOneOf(INFILL_SHAPE_TYPES, shape.type)) return { error: `Invalid modules[].infills[${i}].shape.type` };

    const parseDim = (name: string): number | { error: string } => {
      const value = toNumber(shape[name]);
      if (!Number.isFinite(value) || value < 0) return { error: `modules[].infills[${i}].shape.${name} must be a number >= 0` };
      return value;
    };

    const bottomOffsetRaw = shape.bottom_offset_m !== undefined ? toNumber(shape.bottom_offset_m) : undefined;
    if (bottomOffsetRaw !== undefined && (!Number.isFinite(bottomOffsetRaw) || bottomOffsetRaw < 0)) {
      return { error: `modules[].infills[${i}].shape.bottom_offset_m must be a number >= 0` };
    }

    let parsedShape: NonNullable<CostInputsV1['infills']>[number]['shape'];
    if (shape.type === 'rect') {
      const width = parseDim('width_m');
      const height = parseDim('height_m');
      if (typeof width === 'object') return width;
      if (typeof height === 'object') return height;
      parsedShape = {
        type: 'rect',
        width_m: width,
        height_m: height,
        bottom_offset_m: bottomOffsetRaw,
      };
    } else {
      const width = parseDim('width_m');
      const low = parseDim('height_low_m');
      const high = parseDim('height_high_m');
      if (typeof width === 'object') return width;
      if (typeof low === 'object') return low;
      if (typeof high === 'object') return high;
      parsedShape = {
        type: 'mono_slope',
        width_m: width,
        height_low_m: low,
        height_high_m: high,
        bottom_offset_m: bottomOffsetRaw,
      };
    }

    out.push({
      id: infill.id,
      label: typeof infill.label === 'string' ? infill.label : undefined,
      qty: Math.max(1, Math.round(qty)),
      location: infill.location,
      acrylic_source: infill.acrylic_source,
      panel_orientation: infill.panel_orientation ?? 'vertical',
      width_mode: infill.width_mode,
      target_panel_width_m: targetPanelWidth,
      max_panel_width_m: maxPanelWidth,
      support: {
        has_top: support.has_top !== false,
        has_bottom: support.has_bottom !== false,
        has_left: support.has_left !== false,
        has_right: support.has_right !== false,
        internal_support_mode: support.internal_support_mode,
        internal_support_positions_m: internalPositions,
      },
      shape: parsedShape,
    });
  }

  return out;
}

function parseFlashings(raw: unknown): CostInputsV1['flashings'] | { error: string } | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') return { error: 'modules[].flashings must be an object' };

  const source = raw as any;
  const defaultOverridesRaw = source.default_overrides;
  const extrasRaw = source.extras;

  const default_overrides: NonNullable<CostInputsV1['flashings']>['default_overrides'] = [];
  if (defaultOverridesRaw !== undefined) {
    if (!Array.isArray(defaultOverridesRaw)) return { error: 'modules[].flashings.default_overrides must be an array' };
    for (let i = 0; i < defaultOverridesRaw.length; i += 1) {
      const item = defaultOverridesRaw[i];
      if (!item || typeof item !== 'object') return { error: `modules[].flashings.default_overrides[${i}] must be an object` };
      const key = typeof (item as any).key === 'string' ? (item as any).key.trim() : '';
      if (!key) return { error: `modules[].flashings.default_overrides[${i}].key must be a non-empty string` };

      const bandRaw = (item as any).band;
      if (bandRaw !== undefined && !isOneOf(FLASHING_BANDS_OR_NONE, bandRaw)) {
        return { error: `Invalid modules[].flashings.default_overrides[${i}].band` };
      }

      default_overrides.push({
        key,
        band: (bandRaw === undefined ? '0-200' : bandRaw) as any,
      });
    }
  }

  const extras: NonNullable<CostInputsV1['flashings']>['extras'] = [];
  if (extrasRaw !== undefined) {
    if (!Array.isArray(extrasRaw)) return { error: 'modules[].flashings.extras must be an array' };
    for (let i = 0; i < extrasRaw.length; i += 1) {
      const item = extrasRaw[i];
      if (!item || typeof item !== 'object') return { error: `modules[].flashings.extras[${i}] must be an object` };

      const bandRaw = (item as any).band;
      if (bandRaw !== undefined && !isOneOf(FLASHING_BANDS, bandRaw)) {
        return { error: `Invalid modules[].flashings.extras[${i}].band` };
      }

      const length_m = toNumber((item as any).length_m);
      if (!Number.isFinite(length_m) || length_m < 0) {
        return { error: `modules[].flashings.extras[${i}].length_m must be a number >= 0` };
      }

      extras.push({
        band: (bandRaw === undefined ? '0-200' : bandRaw) as any,
        length_m,
      });
    }
  }

  if (!default_overrides.length && !extras.length) return undefined;
  return {
    ...(default_overrides.length ? { default_overrides } : null),
    ...(extras.length ? { extras } : null),
  };
}

function parseAdditionalAluminium(
  raw: unknown,
): CostInputsV1['additional_aluminium'] | { error: string } | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return { error: 'modules[].additional_aluminium must be an array' };

  const rows: NonNullable<CostInputsV1['additional_aluminium']> = [];
  for (let index = 0; index < raw.length; index += 1) {
    const source = raw[index];
    if (!source || typeof source !== 'object') {
      return { error: `modules[].additional_aluminium[${index}] must be an object` };
    }
    const row = source as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const profile = typeof row.profile === 'string' ? row.profile.trim() : '';
    const stockLengthM = toNumber(row.stock_length_m);
    const quantity = toNumber(row.quantity);
    if (!id) return { error: `modules[].additional_aluminium[${index}].id must be a non-empty string` };
    if (!profile) return { error: `modules[].additional_aluminium[${index}].profile must be a non-empty string` };
    if (!Number.isFinite(stockLengthM) || stockLengthM <= 0) {
      return { error: `modules[].additional_aluminium[${index}].stock_length_m must be a number > 0` };
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      return { error: `modules[].additional_aluminium[${index}].quantity must be a whole number from 1 to 1000` };
    }
    rows.push({ id, profile, stock_length_m: stockLengthM, quantity });
  }
  return rows;
}

function parseModule(raw: any): CostInputsV1 | { error: string } {
  const length_m = toNumber(raw.length_m);
  const roof_span_m_raw = raw.roof_span_m;
  const projection_m_raw = raw.projection_m;
  const roof_span_m = roof_span_m_raw !== undefined ? toNumber(roof_span_m_raw) : NaN;
  const projection_m = projection_m_raw !== undefined ? toNumber(projection_m_raw) : NaN;
  const roof_pitch_deg = raw.roof_pitch_deg !== undefined ? toNumber(raw.roof_pitch_deg) : undefined;
  const rafter_spacing_mm = raw.rafter_spacing_mm !== undefined ? toNumber(raw.rafter_spacing_mm) : undefined;
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
  if (rafter_spacing_mm !== undefined && (!Number.isFinite(rafter_spacing_mm) || rafter_spacing_mm <= 0)) {
    return { error: 'modules[].rafter_spacing_mm must be a number > 0' };
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
  if (raw.roof_material === 'none') {
    if (raw.pergola_style !== 'pitched' || raw.box_perimeter_enabled === true) {
      return { error: 'No roofing is only available for the standard pitched frame' };
    }
    if (roof_pitch_deg !== undefined && roof_pitch_deg !== 0) {
      return { error: 'No roofing requires modules[].roof_pitch_deg to be 0' };
    }
  }
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

  const parsedInfills = parseInfills(raw.infills);
  if (parsedInfills && 'error' in parsedInfills) return parsedInfills;
  const parsedFlashings = parseFlashings(raw.flashings);
  if (parsedFlashings && 'error' in parsedFlashings) return parsedFlashings;
  const parsedAdditionalAluminium = parseAdditionalAluminium(raw.additional_aluminium);
  if (parsedAdditionalAluminium && 'error' in parsedAdditionalAluminium) return parsedAdditionalAluminium;

  const resolvedRoofSpanM = roof_span_m_raw !== undefined ? roof_span_m : projection_m;

  return {
    length_m,
    roof_span_m: resolvedRoofSpanM,
    post_cut_height_m: raw.post_cut_height_m !== undefined ? toNumber(raw.post_cut_height_m) : undefined,
    roof_pitch_deg,
    rafter_spacing_mm,
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
    flashings: parsedFlashings,
    additional_aluminium: parsedAdditionalAluminium,
    infills: parsedInfills,
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

  const usesPergolaContract = Array.isArray(body?.pergolas);
  const usesLegacyModuleContract = Array.isArray(body?.modules);
  if (!usesPergolaContract && !usesLegacyModuleContract) return badRequest('pergolas or modules must be an array');
  if (usesPergolaContract && usesLegacyModuleContract) return badRequest('Provide either pergolas or modules (not both).');
  if (body.job_type !== undefined && !isOneOf(JOB_TYPES, body.job_type)) return badRequest('Invalid job_type');
  if (body.pricing_classification !== undefined && !isOneOf(PRICING_CLASSIFICATIONS, body.pricing_classification)) {
    return badRequest('Invalid pricing_classification');
  }
  if (body.approval_requirement !== undefined && !isOneOf(APPROVAL_REQUIREMENTS, body.approval_requirement)) {
    return badRequest('Invalid approval_requirement');
  }

  const travel_ex_gst = body.travel_ex_gst !== undefined ? toNumber(body.travel_ex_gst) : undefined;
  const extras_allowance_ex_gst = body.extras_allowance_ex_gst !== undefined ? toNumber(body.extras_allowance_ex_gst) : undefined;
  const quote_discount_pct = body.quote_discount_pct !== undefined ? toNumber(body.quote_discount_pct) : undefined;

  const site: SiteInputsV1 = {
    pergolas: [],
    job_type: body.job_type,
    pricing_classification: body.pricing_classification,
    approval_requirement: body.approval_requirement,
    travel_ex_gst,
    extras_allowance_ex_gst,
    quote_discount_pct,
  };

  if (body.additional_aluminium !== undefined) {
    const rawAdditional = body.additional_aluminium;
    if (!rawAdditional || typeof rawAdditional !== 'object') return badRequest('additional_aluminium must be an object');
    const rows = parseAdditionalAluminium(rawAdditional.rows);
    if (rows && 'error' in rows) return badRequest(rows.error.replaceAll('modules[].additional_aluminium', 'additional_aluminium.rows'));
    if (!rows?.length) return badRequest('additional_aluminium.rows must contain at least one item');
    if (!isOneOf(EXTRUSION_COLOURS, rawAdditional.extrusion_colour)) return badRequest('Invalid additional_aluminium.extrusion_colour');
    if (rawAdditional.powdercoat_standard_colour !== undefined
      && !isOneOf(POWDERCOAT_STANDARD_COLOURS, rawAdditional.powdercoat_standard_colour)) {
      return badRequest('Invalid additional_aluminium.powdercoat_standard_colour');
    }
    if (rawAdditional.powdercoat_is_custom !== undefined && typeof rawAdditional.powdercoat_is_custom !== 'boolean') {
      return badRequest('additional_aluminium.powdercoat_is_custom must be a boolean');
    }
    if (rawAdditional.powdercoat_custom_colour !== undefined && typeof rawAdditional.powdercoat_custom_colour !== 'string') {
      return badRequest('additional_aluminium.powdercoat_custom_colour must be a string');
    }
    if (rawAdditional.powdercoat_is_custom === true && !String(rawAdditional.powdercoat_custom_colour ?? '').trim()) {
      return badRequest('additional_aluminium.powdercoat_custom_colour is required for custom powdercoat');
    }
    if (rawAdditional.extrusion_colour === 'Mill'
      && rawAdditional.powdercoat_is_custom !== true
      && !rawAdditional.powdercoat_standard_colour) {
      return badRequest('additional_aluminium.powdercoat_standard_colour is required for powdercoat');
    }
    site.additional_aluminium = {
      rows,
      extrusion_colour: rawAdditional.extrusion_colour,
      powdercoat_standard_colour: typeof rawAdditional.powdercoat_standard_colour === 'string'
        ? rawAdditional.powdercoat_standard_colour
        : undefined,
      powdercoat_is_custom: rawAdditional.powdercoat_is_custom === true,
      powdercoat_custom_colour: typeof rawAdditional.powdercoat_custom_colour === 'string'
        ? rawAdditional.powdercoat_custom_colour
        : undefined,
    };
  }

  if (body.standalone_infills !== undefined) {
    const rawStandalone = body.standalone_infills;
    if (!rawStandalone || typeof rawStandalone !== 'object') return badRequest('standalone_infills must be an object');
    const infills = parseInfills(rawStandalone.infills);
    if (infills && 'error' in infills) return badRequest(infills.error.replaceAll('modules[].infills', 'standalone_infills.infills'));
    if (!infills?.length) return badRequest('standalone_infills.infills must contain at least one infill');
    if (!isOneOf(EXTRUSION_COLOURS, rawStandalone.extrusion_colour)) return badRequest('Invalid standalone_infills.extrusion_colour');
    if (!isOneOf(ACCESS_LEVELS, rawStandalone.access)) return badRequest('Invalid standalone_infills.access');
    if (!isOneOf(HEIGHT_CATEGORIES, rawStandalone.height)) return badRequest('Invalid standalone_infills.height');
    if (rawStandalone.powdercoat_standard_colour !== undefined
      && !isOneOf(POWDERCOAT_STANDARD_COLOURS, rawStandalone.powdercoat_standard_colour)) {
      return badRequest('Invalid standalone_infills.powdercoat_standard_colour');
    }
    if (rawStandalone.powdercoat_is_custom !== undefined && typeof rawStandalone.powdercoat_is_custom !== 'boolean') {
      return badRequest('standalone_infills.powdercoat_is_custom must be a boolean');
    }
    if (rawStandalone.powdercoat_custom_colour !== undefined && typeof rawStandalone.powdercoat_custom_colour !== 'string') {
      return badRequest('standalone_infills.powdercoat_custom_colour must be a string');
    }
    if (rawStandalone.powdercoat_is_custom === true && !String(rawStandalone.powdercoat_custom_colour ?? '').trim()) {
      return badRequest('standalone_infills.powdercoat_custom_colour is required for custom powdercoat');
    }
    if (rawStandalone.extrusion_colour === 'Mill'
      && rawStandalone.powdercoat_is_custom !== true
      && !rawStandalone.powdercoat_standard_colour) {
      return badRequest('standalone_infills.powdercoat_standard_colour is required for powdercoat');
    }
    site.standalone_infills = {
      infills,
      extrusion_colour: rawStandalone.extrusion_colour,
      powdercoat_standard_colour: typeof rawStandalone.powdercoat_standard_colour === 'string'
        ? rawStandalone.powdercoat_standard_colour
        : undefined,
      powdercoat_is_custom: rawStandalone.powdercoat_is_custom === true,
      powdercoat_custom_colour: typeof rawStandalone.powdercoat_custom_colour === 'string'
        ? rawStandalone.powdercoat_custom_colour
        : undefined,
      access: rawStandalone.access,
      height: rawStandalone.height,
    };
  }

  if (usesPergolaContract) {
    const pergolas: PergolaInputsV1[] = [];
    for (let pIdx = 0; pIdx < body.pergolas.length; pIdx += 1) {
      const rawPergola = body.pergolas[pIdx];
      if (!rawPergola || typeof rawPergola !== 'object') return badRequest(`pergolas[${pIdx}] must be an object`);

      const rawModules = (rawPergola as any).modules;
      if (!Array.isArray(rawModules) || rawModules.length === 0) return badRequest(`pergolas[${pIdx}].modules must be a non-empty array`);

      const modules: CostInputsV1[] = [];
      for (let mIdx = 0; mIdx < rawModules.length; mIdx += 1) {
        const raw = rawModules[mIdx];
        if (!raw || typeof raw !== 'object') return badRequest(`pergolas[${pIdx}].modules[${mIdx}] must be an object`);
        const parsed = parseModule(raw);
        if ('error' in parsed) return badRequest(`pergolas[${pIdx}].modules[${mIdx}]: ${parsed.error}`);
        modules.push(parsed);
      }

      pergolas.push({
        id: typeof (rawPergola as any).id === 'string' ? (rawPergola as any).id : undefined,
        label: typeof (rawPergola as any).label === 'string' ? (rawPergola as any).label : undefined,
        modules,
      });
    }
    site.pergolas = pergolas;
  } else {
    if (body.modules.length === 0) return badRequest('modules must be a non-empty array');
    const modules: CostInputsV1[] = [];
    for (let mIdx = 0; mIdx < body.modules.length; mIdx += 1) {
      const raw = body.modules[mIdx];
      if (!raw || typeof raw !== 'object') return badRequest(`modules[${mIdx}] must be an object`);
      const parsed = parseModule(raw);
      if ('error' in parsed) return badRequest(parsed.error);
      modules.push(parsed);
    }

    site.pergolas = [{ id: 'pergola-1', label: 'Pergola 1', modules }];
  }

  try {
    const { config, provenance } = await resolvePublishedCostingConfiguration();
    const result = calculateSiteCostV1(site, config);
    return NextResponse.json({ ...result, costingConfiguration: provenance });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Costing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
