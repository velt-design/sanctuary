import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
  normalizeBlindsState,
} from '@/lib/types/calculator';
import type { Estimate } from '@/lib/types/estimate';
import type { CostInputsV1, JobInputsV1, JobOutputV1, RoofType } from '@sp/costing';
import { calculateJobCostV1 } from '@sp/costing';
import { priceAllBlinds, type BlindLineItemInput } from '@/lib/costing/blinds';
import type { QuoteLineItem } from './types';
import { lineTotalCents, toCents } from './utils';

const RAFTER_SPACING_MM_MAX = 642;
const DEFAULT_MIXED_ACRYLIC_BAYS = 2;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number.parseFloat(value);
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toNonNegativeInt(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : NaN;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeOverrideValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getRoofTypeForModule(module: CalculatorModuleInputs): RoofType {
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  return 'pitched';
}

function computeBayCountsForModule(module: CalculatorModuleInputs): { roofType: RoofType; bayCountMain: number; bayCountA: number; bayCountB: number } {
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

function normaliseCalculatorInputs(inputs: unknown): CalculatorInputs | null {
  if (isCalculatorInputsV2(inputs)) return inputs;
  if (isLegacyCalculatorInputsV1(inputs)) return migrateLegacyCalculatorInputsToV2(inputs);
  return null;
}

function buildJobInputs(inputs: CalculatorInputs): JobInputsV1 {
  const travel_ex_gst = toNumber(inputs.travelExGst);
  const extras_allowance_ex_gst = toNumber(inputs.extrasAllowanceExGst);
  const quote_discount_pct = toNumber(inputs.quoteDiscountPct);

  const modules: CostInputsV1[] = inputs.modules.map((module) => {
    const length_m = toNumber(module.lengthM);
    const roof_span_m = toNumber(module.projectionM);
    const post_cut_height_m = toNumber(module.postCutHeightM);
    const roof_pitch_deg = module.roofPitchDeg.trim() ? toNumber(module.roofPitchDeg) : NaN;
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
      timber_roof_above_type:
        module.roofMaterial === 'timber' || module.roofMaterial === 'mixed' ? module.timberRoofAboveType : undefined,
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
              acrylic_bays_by_plane: ((): Record<string, number> => {
                if (bayCounts.roofType === 'pitched') {
                  return { main: clampInt(toNonNegativeInt(module.mixedAcrylicBaysMain), 0, bayCounts.bayCountMain) };
                }
                return {
                  A: clampInt(toNonNegativeInt(module.mixedAcrylicBaysA), 0, bayCounts.bayCountA),
                  B: clampInt(toNonNegativeInt(module.mixedAcrylicBaysB), 0, bayCounts.bayCountB),
                };
              })(),
            }
          : undefined,
      hip_corner:
        module.pergolaStyle === 'hip_corner'
          ? {
              length_b_m: Number.isFinite(hip_corner_length_b_m) && hip_corner_length_b_m > 0 ? hip_corner_length_b_m : undefined,
              projection_b_m:
                Number.isFinite(hip_corner_projection_b_m) && hip_corner_projection_b_m > 0 ? hip_corner_projection_b_m : undefined,
            }
          : undefined,

      house_connection_type: module.houseConnectionType,
      post_connection_type: module.postConnectionType,
      access: inputs.access,
      height: inputs.height,
      ground: isPile ? module.ground : undefined,

      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };
  });

  return {
    modules,
    travel_ex_gst: Number.isFinite(travel_ex_gst) ? travel_ex_gst : 0,
    extras_allowance_ex_gst: Number.isFinite(extras_allowance_ex_gst) ? extras_allowance_ex_gst : 0,
    quote_discount_pct: Number.isFinite(quote_discount_pct) ? quote_discount_pct : 0,
  };
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase())
    .trim();
}

function formatDimension(value: string): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}`;
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function buildModuleDescription(module: CalculatorModuleInputs, index: number): string {
  const lines: string[] = [];
  const style = toTitleCase(module.pergolaStyle);
  const roof = toTitleCase(module.roofMaterial);
  const colour = module.powdercoatIsCustom
    ? `${module.extrusionColour} (${module.powdercoatCustomColour?.trim() || 'custom'})`
    : `${module.extrusionColour}${module.powdercoatStandardColour?.trim() ? ` (${module.powdercoatStandardColour.trim()})` : ''}`;

  const length = formatDimension(module.lengthM);
  const projection = formatDimension(module.projectionM);
  const size = module.pergolaStyle === 'hip_corner'
    ? `A ${length}m x ${projection}m, B ${formatDimension(module.hipCornerLengthBM)}m x ${formatDimension(module.hipCornerProjectionBM)}m`
    : `${length}m x ${projection}m`;

  const pitch = module.roofPitchDeg?.trim() ? `${module.roofPitchDeg.trim()}°` : 'default';

  lines.push(`Pergola module ${index + 1}`);
  lines.push(`- Style: ${style}`);
  lines.push(`- Roof: ${roof}`);
  lines.push(`- Size: ${size}`);
  lines.push(`- Colour: ${colour}`);
  lines.push(`- Pitch: ${pitch}`);
  lines.push(`- Posts: ${module.postCount || '—'}`);
  lines.push(`- Connections: house=${module.houseConnectionType}, posts=${module.postConnectionType}`);

  return lines.join('\n');
}

function buildBlindDescription(item: BlindLineItemInput, idx: number, label?: string, errors?: string[]): string {
  const lines: string[] = [];
  const title = label ? `Blind ${idx + 1} (${label})` : `Blind ${idx + 1}`;
  lines.push(title);
  lines.push(`- System: ${item.system}`);
  lines.push(`- Size: ${Number.isFinite(item.widthMm ?? NaN) ? Math.round(item.widthMm ?? 0) : '—'}mm x ${
    Number.isFinite(item.coverLengthMm ?? NaN) ? Math.round(item.coverLengthMm ?? 0) : '—'
  }mm`);
  lines.push(`- Fabric: ${item.fabric}`);
  lines.push(`- Motorised: ${item.motorised ? 'Yes' : 'No'}`);
  if (errors && errors.length) lines.push(`- Note: ${errors.join(' ')}`);
  return lines.join('\n');
}

function isMeaningfulBlindItem(item: {
  label?: string;
  system?: string;
  fabric?: string;
  motorised?: string | boolean | null;
  widthMm?: unknown;
  coverLengthMm?: unknown;
}): boolean {
  const hasLabel = typeof item.label === 'string' && item.label.trim().length > 0;
  const width = toNumber(item.widthMm);
  const cover = toNumber(item.coverLengthMm);
  const hasWidth = Number.isFinite(width) && width > 0;
  const hasCover = Number.isFinite(cover) && cover > 0;

  const system = typeof item.system === 'string' ? item.system.toUpperCase() : 'ZIPTRAK';
  const fabric = typeof item.fabric === 'string' ? item.fabric.toUpperCase() : 'MESH';
  const motorisedRaw = typeof item.motorised === 'string' ? item.motorised.toUpperCase() : item.motorised ? 'YES' : 'NONE';
  const hasNonDefault =
    system !== 'ZIPTRAK' ||
    (fabric !== 'MESH' && fabric !== 'NONE') ||
    motorisedRaw === 'YES';

  return hasLabel || hasWidth || hasCover || hasNonDefault;
}

function extractLightingTotalCents(estimate: Estimate): number | null {
  const inputs: any = (estimate as any).inputs ?? {};
  const outputs: any = (estimate as any).outputs ?? {};

  const candidates: Array<unknown> = [
    inputs?.lighting_total_inc_gst,
    inputs?.lightingTotalIncGst,
    inputs?.lighting?.totalIncGst,
    inputs?.lighting?.total_inc_gst,
    outputs?.lighting_total_inc_gst,
    outputs?.lightingTotalIncGst,
    outputs?.lighting?.totalIncGst,
  ];

  for (const value of candidates) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN;
    if (Number.isFinite(n) && n > 0) return toCents(n);
  }

  return null;
}

function allocateExtraCents(base: number[], extra: number): number[] {
  if (!base.length) return [];
  if (!extra) return base.map(() => 0);

  const sum = base.reduce((acc, n) => acc + n, 0);
  if (sum <= 0) {
    const even = Math.floor(extra / base.length);
    const remainder = extra - even * base.length;
    return base.map((_, idx) => even + (idx < remainder ? 1 : 0));
  }

  let remainder = extra;
  const allocations = base.map((value) => {
    const share = Math.round((value / sum) * extra);
    remainder -= share;
    return share;
  });

  // Fix rounding drift.
  let idx = 0;
  while (remainder !== 0 && allocations.length > 0) {
    allocations[idx % allocations.length] += remainder > 0 ? 1 : -1;
    remainder += remainder > 0 ? -1 : 1;
    idx += 1;
  }

  return allocations;
}

export function buildQuoteLineItemsFromEstimate(estimate: Estimate): { items: Omit<QuoteLineItem, 'id'>[]; coreTotalIncCents: number } {
  const inputs = normaliseCalculatorInputs((estimate as any).inputs);
  const modules = inputs?.modules ?? [];

  let jobOutput: JobOutputV1 | null = null;
  if (inputs) {
    try {
      const jobInputs = buildJobInputs(inputs);
      jobOutput = calculateJobCostV1(jobInputs);
    } catch {
      jobOutput = null;
    }
  }

  const moduleTotalsInc = jobOutput?.modules?.map((m) => toCents(m?.totals?.cost_inc_gst ?? 0)) ?? [];
  const coreTotalIncCents = jobOutput ? toCents(jobOutput.totals.cost_inc_gst) : toCents((estimate.outputs as any)?.totals?.cost_inc_gst ?? 0);

  const moduleExtraAllocations = allocateExtraCents(moduleTotalsInc, coreTotalIncCents - moduleTotalsInc.reduce((sum, n) => sum + n, 0));

  const lineItems: Omit<QuoteLineItem, 'id'>[] = [];

  modules.forEach((module, idx) => {
    const base = moduleTotalsInc[idx] ?? 0;
    const unitPrice = Math.max(0, base + (moduleExtraAllocations[idx] ?? 0));
    const qty = 1;
    lineItems.push({
      description: buildModuleDescription(module, idx),
      qty,
      unitPriceIncGstCents: unitPrice,
      lineTotalIncGstCents: lineTotalCents(qty, unitPrice),
      sortOrder: lineItems.length,
    });
  });

  const lightingTotal = extractLightingTotalCents(estimate);
  if (lightingTotal !== null) {
    const qty = 1;
    const description = ['Lighting', '- Inclusive of hardware, wiring, and electrical'].join('\n');
    lineItems.push({
      description,
      qty,
      unitPriceIncGstCents: lightingTotal,
      lineTotalIncGstCents: lineTotalCents(qty, lightingTotal),
      sortOrder: lineItems.length,
    });
  }

  const blindsState = normalizeBlindsState((inputs as any)?.blinds);
  const blindItems = (blindsState?.items ?? []).filter((item) => isMeaningfulBlindItem(item as any));
  if (blindItems.length) {
    const pricingInputs: BlindLineItemInput[] = blindItems.map((item) => ({
      id: item.id,
      label: item.label,
      system: item.system,
      widthMm: Number.isFinite(toNumber(item.widthMm)) ? toNumber(item.widthMm) : null,
      coverLengthMm: Number.isFinite(toNumber(item.coverLengthMm)) ? toNumber(item.coverLengthMm) : null,
      fabric: item.fabric,
      motorised: item.motorised === 'YES',
    }));

    const pricing = priceAllBlinds(pricingInputs);
    pricing.items.forEach((priced, idx) => {
      const qty = 1;
      const unitPrice = priced.errors.length ? 0 : priced.blindSellIncCents;
      const source = pricingInputs[idx];
      lineItems.push({
        description: buildBlindDescription(source ?? {
          id: priced.id,
          label: priced.label,
          system: priced.system,
          widthMm: priced.widthMm,
          coverLengthMm: priced.coverLengthMm,
          fabric: 'NONE',
          motorised: null,
        }, idx, priced.label, priced.errors),
        qty,
        unitPriceIncGstCents: unitPrice,
        lineTotalIncGstCents: lineTotalCents(qty, unitPrice),
        sortOrder: lineItems.length,
      });
    });
  }

  return { items: lineItems, coreTotalIncCents };
}
