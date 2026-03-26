import type { CostInputsV1, CostOutputV1, SiteInputsV1, SiteOutputV1 } from '@sp/costing';
import {
  RAFTER_SPACING_MM_MAX,
  resolveMonoSlopeShape,
  resolvePayloadPanelOrientation,
} from '@/app/staff/calculator/infillCompute';
import type {
  CalculatorFlashingBand,
  CalculatorFlashingPurpose,
  CalculatorInfillsState,
  CalculatorInputs,
  CalculatorModuleInputs,
  CalculatorPergola,
  InfillLineItem,
} from '@/lib/types/calculator';
import { DEFAULT_CALCULATOR_ATTACHMENT_SIDE, normalizeAttachmentSide } from '@/lib/types/calculator';
import type { PortalEstimatePayload } from '@/lib/localFirst/portalEntities';

type AnyRecord = Record<string, unknown>;
export type EstimateSaveMode = 'preserve_current' | 'reprice_latest';
export type EstimatePricingSyncState = 'current' | 'stale';

export const ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY = 'pricing_sync_state';

const DEFAULT_MIXED_ACRYLIC_BAYS = 2;
const FLASHING_EDGE_ALLOWANCE_M = 0.1;
const COST_OUTPUT_KEYS = new Set([
  'cost_snapshot_version',
  'materials',
  'install',
  'overhead',
  'totals',
  'warnings',
  'pergolas',
  'siteShared',
  'shared',
  ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY,
]);

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toNonNegativeInt(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : Number.NaN;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeFlashingBand(value: unknown): CalculatorFlashingBand {
  if (value === '201-300' || value === '301-400') return value;
  return '0-200';
}

function normalizeFlashingPurpose(value: unknown): CalculatorFlashingPurpose {
  if (value === 'HEAD' || value === 'SIDE' || value === 'APRON') return value;
  return 'CUSTOM';
}

function normalizeOverrideValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getRoofTypeForModule(module: CalculatorModuleInputs): 'pitched' | 'gable' | 'hip' | 'hip_corner' {
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  return 'pitched';
}

function roofLengthForPrimaryFlashing(module: CalculatorModuleInputs): number {
  const lengthM = Number.isFinite(toNumber(module.lengthM)) ? Math.max(0, toNumber(module.lengthM)) : 0;
  if (module.pergolaStyle !== 'hip_corner') return lengthM;
  const lengthBM = Number.isFinite(toNumber(module.hipCornerLengthBM)) ? Math.max(0, toNumber(module.hipCornerLengthBM)) : 0;
  return lengthM + lengthBM;
}

function defaultPrimaryFlashingBandForModule(module: CalculatorModuleInputs): CalculatorFlashingBand {
  const roofType = getRoofTypeForModule(module);
  if (roofType === 'gable') return '301-400';
  return '201-300';
}

function primaryFlashingDefaultKeyForModule(module: CalculatorModuleInputs): string {
  const roofType = getRoofTypeForModule(module);
  if (roofType === 'pitched') return 'pitched_primary';
  if (roofType === 'gable') return 'gable_ridge';
  if (roofType === 'hip') return 'hip_ledger';
  return 'roof_primary';
}

function formatFlashingLengthInput(lengthM: number): string {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return '1.0';
  const rounded = Math.round(lengthM * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '') || '1.0';
}

function getDefaultPitchForModule(module: CalculatorModuleInputs): number {
  const roofType = getRoofTypeForModule(module);
  if (roofType === 'gable' || roofType === 'hip' || roofType === 'hip_corner') return 25;
  return 5;
}

function getPitchForModule(module: CalculatorModuleInputs): number {
  const parsed = toNumber(module.roofPitchDeg);
  if (Number.isFinite(parsed)) return Math.max(0, Math.min(85, parsed));
  return getDefaultPitchForModule(module);
}

function computeBayCountsForModule(
  module: CalculatorModuleInputs,
): { roofType: 'pitched' | 'gable' | 'hip' | 'hip_corner'; bayCountMain: number; bayCountA: number; bayCountB: number } {
  const roofType = getRoofTypeForModule(module);
  const lengthM = toNumber(module.lengthM);
  const lengthMmA = Number.isFinite(lengthM) && lengthM > 0 ? Math.round(lengthM * 1000) : 0;
  const rafterCountA = lengthMmA > 0 ? Math.ceil(lengthMmA / RAFTER_SPACING_MM_MAX) + 1 : 0;
  const bayCountA = Math.max(0, rafterCountA - 1);

  if (roofType === 'hip_corner') {
    const lengthBM = toNumber(module.hipCornerLengthBM);
    const lengthMmB = Number.isFinite(lengthBM) && lengthBM > 0 ? Math.round(lengthBM * 1000) : 0;
    const rafterCountB = lengthMmB > 0 ? Math.ceil(lengthMmB / RAFTER_SPACING_MM_MAX) + 1 : 0;
    const bayCountB = Math.max(0, rafterCountB - 1);
    return { roofType, bayCountMain: 0, bayCountA, bayCountB };
  }

  if (roofType === 'pitched') return { roofType, bayCountMain: bayCountA, bayCountA: 0, bayCountB: 0 };
  return { roofType, bayCountMain: 0, bayCountA, bayCountB: bayCountA };
}

function buildFlashingDefaultsForModule(
  module: CalculatorModuleInputs,
): Array<{ key: string; defaultBand: CalculatorFlashingBand; lengthM: number }> {
  const roofType = getRoofTypeForModule(module);
  const projectionM = Number.isFinite(toNumber(module.projectionM)) ? Math.max(0, toNumber(module.projectionM)) : 0;
  const roofLengthM = roofLengthForPrimaryFlashing(module);
  const out: Array<{ key: string; defaultBand: CalculatorFlashingBand; lengthM: number }> = [];

  const addDefault = (key: string, defaultBand: CalculatorFlashingBand, lengthRaw: number) => {
    const length = Number(lengthRaw);
    if (!Number.isFinite(length) || length <= 0) return;
    out.push({ key, defaultBand, lengthM: length });
  };

  if (roofType === 'pitched') {
    addDefault('pitched_primary', '201-300', roofLengthM);
    if (module.invertedEnabled) addDefault('pitched_secondary', '201-300', roofLengthM);
  } else if (roofType === 'gable') {
    addDefault('gable_ridge', '301-400', roofLengthM);
  } else if (roofType === 'hip') {
    addDefault('hip_ledger', '201-300', roofLengthM);
  } else {
    addDefault('roof_primary', '201-300', roofLengthM);
  }

  const hasTimber = module.roofMaterial === 'timber' || module.roofMaterial === 'mixed';
  if (!hasTimber) return out;

  const pitchDeg = getPitchForModule(module);
  const cos = Math.max(0.02, Math.cos((pitchDeg * Math.PI) / 180));
  const runM = roofType === 'gable' || roofType === 'hip' ? projectionM / 2 : projectionM;
  const edgeLengthM = Math.max(0, (runM > 0 ? runM / cos : 0) + FLASHING_EDGE_ALLOWANCE_M);

  if (roofType === 'pitched') {
    addDefault('timber_edge_left', '0-200', edgeLengthM);
    addDefault('timber_edge_right', '0-200', edgeLengthM);
  } else if (roofType === 'gable') {
    addDefault('timber_edge_a_left', '0-200', edgeLengthM);
    addDefault('timber_edge_a_right', '0-200', edgeLengthM);
    addDefault('timber_edge_b_left', '0-200', edgeLengthM);
    addDefault('timber_edge_b_right', '0-200', edgeLengthM);
  }

  return out;
}

function normalizeInfillsState(value: unknown): CalculatorInfillsState {
  if (!value || typeof value !== 'object' || !Array.isArray((value as any).items)) return { items: [] };
  return value as CalculatorInfillsState;
}

function estimateRoofRafterSpacing(lengthM: number, derivedRafterCount?: number): { spacingM: number; source: 'derived' | 'fallback' } {
  if (typeof derivedRafterCount === 'number' && Number.isFinite(derivedRafterCount) && derivedRafterCount > 1 && Number.isFinite(lengthM) && lengthM > 0) {
    return {
      spacingM: Math.max(0.05, lengthM / (Math.max(2, Math.round(derivedRafterCount)) - 1)),
      source: 'derived',
    };
  }
  if (Number.isFinite(lengthM) && lengthM > 0) {
    const bays = Math.max(1, Math.ceil((lengthM * 1000) / RAFTER_SPACING_MM_MAX));
    return { spacingM: Math.max(0.05, lengthM / bays), source: 'fallback' };
  }
  return { spacingM: RAFTER_SPACING_MM_MAX / 1000, source: 'fallback' };
}

function parseInfillsForPayload(module: CalculatorModuleInputs): CostInputsV1['infills'] | undefined {
  const infills = normalizeInfillsState((module as any).infills);
  if (!Array.isArray(infills.items) || infills.items.length === 0) return undefined;

  const out: NonNullable<CostInputsV1['infills']> = [];
  const roofRafterSpacingM = estimateRoofRafterSpacing(toNumber(module.lengthM)).spacingM;

  for (const raw of infills.items as InfillLineItem[]) {
    const maxPanelWidth = toNumber(raw.maxPanelWidthM);
    const targetPanelWidth = toNumber(raw.targetPanelWidthM);
    const qty = toNumber(raw.qty);
    const widthMode =
      (raw.location === 'front' || raw.location === 'house') && raw.widthMode === 'match_roof_rafters'
        ? 'match_roof_rafters'
        : 'target_width';

    const internalPositions = Array.isArray(raw.support.internalSupportPositionsM)
      ? raw.support.internalSupportPositionsM
          .map(toNumber)
          .filter((n) => Number.isFinite(n) && n >= 0)
      : undefined;

    const shapeOut: NonNullable<CostInputsV1['infills']>[number]['shape'] =
      raw.shape.type === 'rect'
        ? {
            type: 'rect',
            width_m: Number.isFinite(toNumber(raw.shape.widthM)) ? toNumber(raw.shape.widthM) : 0,
            height_m: Number.isFinite(toNumber(raw.shape.heightM)) ? toNumber(raw.shape.heightM) : 0,
            bottom_offset_m: Number.isFinite(toNumber(raw.shape.bottomOffsetM ?? '')) ? toNumber(raw.shape.bottomOffsetM ?? '') : undefined,
          }
        : {
            type: 'mono_slope',
            width_m: Number.isFinite(toNumber(raw.shape.widthM)) ? toNumber(raw.shape.widthM) : 0,
            height_low_m: resolveMonoSlopeShape(raw.shape).leftHeightM,
            height_high_m: resolveMonoSlopeShape(raw.shape).rightHeightM,
            bottom_offset_m: Number.isFinite(toNumber(raw.shape.bottomOffsetM ?? '')) ? toNumber(raw.shape.bottomOffsetM ?? '') : undefined,
          };

    out.push({
      id: raw.id,
      label: raw.label?.trim() ? raw.label.trim() : undefined,
      qty: Number.isFinite(qty) && qty >= 1 ? Math.round(qty) : 1,
      location: raw.location,
      acrylic_source: raw.acrylicSource,
      panel_orientation: resolvePayloadPanelOrientation(raw, roofRafterSpacingM),
      width_mode: widthMode,
      target_panel_width_m: Number.isFinite(targetPanelWidth) ? targetPanelWidth : undefined,
      max_panel_width_m: Number.isFinite(maxPanelWidth) ? Math.min(1.2, Math.max(0.2, maxPanelWidth)) : undefined,
      support: {
        has_top: raw.support.hasTop !== false,
        has_bottom: raw.support.hasBottom !== false,
        has_left: raw.support.hasLeft !== false,
        has_right: raw.support.hasRight !== false,
        internal_support_mode: raw.support.internalSupportMode,
        internal_support_positions_m: internalPositions,
      },
      shape: shapeOut,
    });
  }

  return out.length ? out : undefined;
}

function normalizePergolas(pergolas: CalculatorInputs['pergolas']): CalculatorPergola[] {
  const out =
    Array.isArray(pergolas) && pergolas.length
      ? pergolas
          .filter((pergola): pergola is CalculatorPergola => Boolean(pergola && typeof pergola.id === 'string' && pergola.id.trim()))
          .map((pergola, index) => ({
            id: pergola.id.trim(),
            label: typeof pergola.label === 'string' && pergola.label.trim() ? pergola.label.trim() : `Pergola ${index + 1}`,
          }))
      : [];

  return out.length ? out : [{ id: 'pergola-1', label: 'Pergola 1' }];
}

function buildModuleCostInputs(
  module: CalculatorModuleInputs,
  access: CalculatorInputs['access'],
  height: CalculatorInputs['height'],
): CostInputsV1 {
  const length_m = toNumber(module.lengthM);
  const roof_span_m = toNumber(module.projectionM);
  const post_cut_height_m = toNumber(module.postCutHeightM);
  const roof_pitch_deg = module.roofPitchDeg.trim() ? toNumber(module.roofPitchDeg) : Number.NaN;
  const post_count = toNumber(module.postCount);
  const downpipe_count = toNumber(module.downpipeCount);
  const downpipe_join_count = toNumber(module.downpipeJoinCount);
  const downpipe_elbow_count = toNumber(module.downpipeElbowCount);
  const fall_distance_mm = toNumber(module.fallDistanceMm);
  const hip_corner_length_b_m = toNumber(module.hipCornerLengthBM);
  const hip_corner_projection_b_m = toNumber(module.hipCornerProjectionBM);
  const isPile = module.postConnectionType === 'pile_1m' || module.postConnectionType === 'pile_1_5m';
  const bayCounts = computeBayCountsForModule(module);
  const overrides = module.overrides ?? {};
  const flashingsState = module.flashings?.rows ?? [];
  const flashingDefaults = buildFlashingDefaultsForModule(module);
  const flashingDefaultOverrides = flashingDefaults.map((item) => ({
    key: String(item.key),
    band: 'none' as const,
  }));
  const flashingExtras = flashingsState
    .map((extra) => ({
      band: normalizeFlashingBand(extra.band),
      length_m: toNumber(extra.lengthM),
    }))
    .filter((extra) => Number.isFinite(extra.length_m) && extra.length_m > 0);
  const flashings =
    flashingDefaultOverrides.length || flashingExtras.length
      ? {
          ...(flashingDefaultOverrides.length ? { default_overrides: flashingDefaultOverrides } : null),
          ...(flashingExtras.length ? { extras: flashingExtras } : null),
        }
      : undefined;

  return {
    length_m,
    roof_span_m,
    post_cut_height_m,
    roof_pitch_deg: Number.isFinite(roof_pitch_deg) ? roof_pitch_deg : undefined,
    post_count,
    pergola_style: module.pergolaStyle,
    gable_end_frames_mode: module.gableEndFramesMode,
    box_perimeter_enabled: module.boxPerimeterEnabled,
    internal_roof_type: module.boxPerimeterEnabled ? undefined : module.internalRoofType,
    fall_distance_mm: module.boxPerimeterEnabled ? fall_distance_mm : undefined,
    box_gutter_house_edge: module.boxPerimeterEnabled ? module.boxGutterHouseEdge : undefined,
    box_gutter_far_edge: module.boxPerimeterEnabled ? module.boxGutterFarEdge : undefined,
    gable_house_edge_gutter: module.pergolaStyle === 'gable' ? module.gableHouseEdgeGutter : undefined,
    gable_outer_edge_gutter: module.pergolaStyle === 'gable' ? module.gableOuterEdgeGutter : undefined,
    downpipe_count: Number.isFinite(downpipe_count) ? downpipe_count : undefined,
    downpipe_join_count: Number.isFinite(downpipe_join_count) ? downpipe_join_count : undefined,
    downpipe_elbow_count: Number.isFinite(downpipe_elbow_count) ? downpipe_elbow_count : undefined,
    separate_gutter_enabled: module.separateGutterEnabled,
    overhang_enabled: module.overhangEnabled,
    overhang_amount_m: module.overhangEnabled ? toNumber(module.overhangAmountM) : undefined,
    overhang_support_beam_profile: module.overhangEnabled ? module.overhangSupportBeamProfile : undefined,
    inverted_enabled: module.invertedEnabled,
    inverted_house_gutter: module.invertedEnabled ? module.invertedHouseGutter : undefined,
    overrides: {
      ledger_profile: normalizeOverrideValue(overrides.ledgerProfile),
      rafter_profile: normalizeOverrideValue(overrides.rafterProfile),
      post_profile: normalizeOverrideValue(overrides.postProfile),
      front_beam_profile: normalizeOverrideValue(overrides.frontBeamProfile),
      ridge_beam_profile: normalizeOverrideValue(overrides.ridgeBeamProfile),
      box_perimeter_beam_profile: normalizeOverrideValue(overrides.boxPerimeterBeamProfile),
      overhang_support_beam_profile: normalizeOverrideValue(overrides.overhangSupportBeamProfile),
      tie_beam_profile: normalizeOverrideValue(overrides.tieBeamProfile),
      strut_profile: normalizeOverrideValue(overrides.strutProfile),
    },
    roof_material: module.roofMaterial,
    extrusion_colour: module.extrusionColour,
    timber_roof_above_type: module.roofMaterial === 'timber' || module.roofMaterial === 'mixed' ? module.timberRoofAboveType : undefined,
    timber_insulated_panel_thickness_mm:
      (module.roofMaterial === 'timber' || module.roofMaterial === 'mixed') && module.timberRoofAboveType === 'insulated_panels'
        ? toNumber(module.timberInsulatedPanelThicknessMm)
        : undefined,
    timber_tray_width_mm:
      (module.roofMaterial === 'timber' || module.roofMaterial === 'mixed') && module.timberRoofAboveType === 'steel_tray'
        ? toNumber(module.timberTrayWidthMm)
        : undefined,
    powdercoat_standard_colour: module.powdercoatStandardColour?.trim() || undefined,
    powdercoat_is_custom: module.powdercoatIsCustom === true,
    powdercoat_custom_colour: module.powdercoatCustomColour?.trim() || undefined,
    mixed_roof:
      module.roofMaterial === 'mixed'
        ? {
            mode: 'acrylic_bays',
            acrylic_bays_by_plane:
              bayCounts.roofType === 'pitched'
                ? { main: clampInt(toNonNegativeInt(module.mixedAcrylicBaysMain), 0, bayCounts.bayCountMain) }
                : {
                    A: clampInt(toNonNegativeInt(module.mixedAcrylicBaysA), 0, bayCounts.bayCountA),
                    B: clampInt(toNonNegativeInt(module.mixedAcrylicBaysB), 0, bayCounts.bayCountB),
                  },
          }
        : undefined,
    flashings,
    hip_corner:
      module.pergolaStyle === 'hip_corner'
        ? {
            length_b_m: Number.isFinite(hip_corner_length_b_m) && hip_corner_length_b_m > 0 ? hip_corner_length_b_m : undefined,
            projection_b_m:
              Number.isFinite(hip_corner_projection_b_m) && hip_corner_projection_b_m > 0 ? hip_corner_projection_b_m : undefined,
          }
        : undefined,
    house_connection_type: module.houseConnectionType,
    attachment_side: module.houseConnectionType === 'none' ? DEFAULT_CALCULATOR_ATTACHMENT_SIDE : normalizeAttachmentSide(module.attachmentSide),
    post_connection_type: module.postConnectionType,
    access,
    height,
    ground: isPile ? module.ground : undefined,
    infills: parseInfillsForPayload(module),
    travel_ex_gst: 0,
    extras_allowance_ex_gst: 0,
    quote_discount_pct: 0,
  };
}

export function buildModuleCostInputsFromCalculatorInputs(inputs: CalculatorInputs, moduleIndex: number): CostInputsV1 | null {
  const module = inputs.modules[moduleIndex];
  if (!module) return null;
  return buildModuleCostInputs(module, inputs.access, inputs.height);
}

export function buildSiteInputsFromCalculatorInputs(inputs: CalculatorInputs): SiteInputsV1 {
  const pergolas = normalizePergolas(inputs.pergolas);
  const groupedPergolas = pergolas.map((pergola) => ({
    id: pergola.id,
    label: pergola.label,
    modules: [] as CostInputsV1[],
  }));
  const groupedById = new Map(groupedPergolas.map((pergola) => [pergola.id, pergola]));
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';

  for (const module of inputs.modules) {
    const moduleInput = buildModuleCostInputs(module, inputs.access, inputs.height);
    const pergolaId =
      typeof module.pergolaId === 'string' && groupedById.has(module.pergolaId)
        ? module.pergolaId
        : fallbackPergolaId;
    const bucket = groupedById.get(pergolaId);
    if (bucket) bucket.modules.push(moduleInput);
  }

  return {
    pergolas: groupedPergolas.filter((pergola) => pergola.modules.length > 0),
    job_type: inputs.jobType,
    travel_ex_gst: Number.isFinite(toNumber(inputs.travelExGst)) ? toNumber(inputs.travelExGst) : 0,
    extras_allowance_ex_gst: Number.isFinite(toNumber(inputs.extrasAllowanceExGst)) ? toNumber(inputs.extrasAllowanceExGst) : 0,
    quote_discount_pct: Number.isFinite(toNumber(inputs.quoteDiscountPct)) ? toNumber(inputs.quoteDiscountPct) : 0,
  };
}

export function getSiteResultModule(result: SiteOutputV1, moduleIndex: number): CostOutputV1 | null {
  const modules = (Array.isArray(result.pergolas) ? result.pergolas : []).flatMap((pergola) =>
    Array.isArray((pergola as any)?.modules) ? (pergola as any).modules : [],
  );
  return (modules[moduleIndex] as CostOutputV1 | undefined) ?? null;
}

export function deriveSiteResultWarnings(result: SiteOutputV1): Array<{ level: 'critical' | 'review' | 'info'; message: string }> {
  const raw = result?.totals?.warnings;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .filter((item) => Boolean(item && typeof item === 'object'))
      .map((item): { level: 'critical' | 'review' | 'info'; message: string } => ({
        level:
          (item as { level?: string }).level === 'critical'
            ? 'critical'
            : (item as { level?: string }).level === 'info'
              ? 'info'
              : 'review',
        message: typeof (item as { message?: unknown }).message === 'string' ? (item as { message: string }).message : '',
      }))
      .filter((item) => item.message.trim().length > 0);
  }

  const notes = Array.isArray(result?.totals?.notes_and_warnings) ? result.totals.notes_and_warnings : [];
  return notes
    .map((message) => (typeof message === 'string' ? message.trim() : ''))
    .filter(Boolean)
    .map((message) => ({ level: 'info' as const, message }));
}

function stripCostOutputs(outputs: AnyRecord): AnyRecord {
  return Object.fromEntries(Object.entries(outputs).filter(([key]) => !COST_OUTPUT_KEYS.has(key)));
}

function cloneRecord<T extends AnyRecord | undefined>(value: T): T {
  if (!value) return value;
  if (typeof structuredClone === 'function') return structuredClone(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSiteInputsForPricingComparison(inputs: CalculatorInputs): SiteInputsV1 {
  const payload = buildSiteInputsFromCalculatorInputs(inputs);
  return {
    ...payload,
    pergolas: payload.pergolas.map((pergola) => ({
      ...pergola,
      label: '',
    })),
  };
}

export function hasPricingAffectingCalculatorInputChanges(previous: CalculatorInputs, next: CalculatorInputs): boolean {
  return JSON.stringify(normalizeSiteInputsForPricingComparison(previous)) !== JSON.stringify(normalizeSiteInputsForPricingComparison(next));
}

export function buildEstimatePayloadPreservingCurrentPricing(args: {
  basePayload: PortalEstimatePayload;
  inputs: CalculatorInputs;
  pricingChanged: boolean;
}): PortalEstimatePayload {
  const outputs = cloneRecord((args.basePayload.outputs ?? {}) as AnyRecord) ?? {};
  if (args.pricingChanged) {
    outputs[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY] = 'stale' satisfies EstimatePricingSyncState;
  }

  return {
    status: args.basePayload.status,
    inputs: args.inputs as unknown as AnyRecord,
    derived: (args.basePayload.derived ?? {}) as AnyRecord,
    projectSnapshot: args.basePayload.projectSnapshot,
    snapshot: args.basePayload.snapshot,
    outputs,
    configVersions: args.basePayload.configVersions,
  };
}

export function buildEstimatePayloadFromSiteCosting(args: {
  basePayload: PortalEstimatePayload;
  inputs: CalculatorInputs;
  siteResult: SiteOutputV1;
  configVersions?: AnyRecord;
  moduleIndex: number;
  warnings?: Array<{ level: 'critical' | 'review' | 'info'; message: string }>;
}): PortalEstimatePayload {
  const moduleResult = getSiteResultModule(args.siteResult, args.moduleIndex);
  const preservedOutputs = stripCostOutputs(args.basePayload.outputs ?? {});

  return {
    status: args.basePayload.status,
    inputs: args.inputs as unknown as AnyRecord,
    derived: (moduleResult?.derived ?? args.basePayload.derived ?? {}) as AnyRecord,
    projectSnapshot: args.basePayload.projectSnapshot,
    snapshot: args.basePayload.snapshot,
    outputs: {
      ...preservedOutputs,
      cost_snapshot_version: 'v2',
      materials: args.siteResult.materials,
      install: args.siteResult.install,
      overhead: args.siteResult.overhead,
      totals: args.siteResult.totals,
      warnings: args.warnings ?? deriveSiteResultWarnings(args.siteResult),
      pergolas: args.siteResult.pergolas,
      siteShared: args.siteResult.shared,
      shared: args.siteResult.shared,
      [ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY]: 'current' satisfies EstimatePricingSyncState,
    },
    configVersions: args.configVersions ?? args.basePayload.configVersions,
  };
}

export function defaultMixedAcrylicBaysForCount(bayCount: number): string {
  return String(clampInt(DEFAULT_MIXED_ACRYLIC_BAYS, 0, bayCount));
}
