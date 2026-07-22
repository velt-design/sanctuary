import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
  normalizeBlindsState,
} from '@/lib/types/calculator';
import type { Estimate } from '@/lib/types/estimate';
import { priceAllBlinds, type BlindLineItemInput } from '@sp/costing';
import type { QuoteLineItem } from './types';
import {
  calculateStaffCustomerPriceFromCostEx,
  normalizeStaffQuoteDiscountPct,
  roundQuoteMoney,
} from './pricing';
import { lineTotalCents, toCents } from './utils';
import {
  formatDimension,
  formatModuleColour,
  formatModulePitch,
  formatModulePosts,
  formatModuleRoof,
  formatModuleSize,
  formatModuleStyle,
  toTitleCase,
} from './moduleFormatters';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number.parseFloat(value);
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normaliseCalculatorInputs(inputs: unknown): CalculatorInputs | null {
  if (isCalculatorInputsV2(inputs)) return inputs;
  if (isLegacyCalculatorInputsV1(inputs)) return migrateLegacyCalculatorInputsToV2(inputs);
  return null;
}

function uniqueModuleStyles(modules: CalculatorModuleInputs[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  modules.forEach((module) => {
    const raw = typeof module?.pergolaStyle === 'string' ? module.pergolaStyle.trim() : '';
    if (!raw) return;
    const normalized = raw.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(toTitleCase(normalized));
  });

  return ordered;
}

function joinStyleLabels(styles: string[]): string {
  if (!styles.length) return 'Custom';
  if (styles.length === 1) return styles[0]!;
  if (styles.length === 2) return `${styles[0]} + ${styles[1]}`;
  return `${styles.slice(0, -1).join(', ')} + ${styles[styles.length - 1]}`;
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

function normalizePergolaId(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizePergolaLabel(value: unknown, fallbackIndex: number): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `Pergola ${fallbackIndex + 1}`;
}

type PricedPergola = {
  snapshotPergola: any;
  idx: number;
  pergolaCostEx: number;
};

type ModuleField = {
  key: 'roof' | 'colour' | 'houseConnection' | 'postFixings';
  label: string;
  value: string | null;
};

function lineUnitPriceIncFromCostEx(costEx: number, quoteDiscountPct: number): number {
  return toCents(calculateStaffCustomerPriceFromCostEx(costEx, quoteDiscountPct)?.incGst ?? 0);
}

function withQuoteDiscountDescription(description: string, quoteDiscountPct: number): string {
  if (quoteDiscountPct <= 0) return description;
  return `${description}\n- Quote discount: ${quoteDiscountPct}% applied`;
}

function normalizeComparisonValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function formatConnectionValue(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return null;
  if (normalized === 'deck_bracket') return 'Deck brackets';
  if (normalized === 'soffit') return 'Soffit brackets';
  return toTitleCase(normalized);
}


function buildSharedCandidateFields(module: CalculatorModuleInputs): ModuleField[] {
  return [
    { key: 'roof', label: 'Roof', value: formatModuleRoof(module) },
    { key: 'colour', label: 'Colour', value: formatModuleColour(module) },
    { key: 'houseConnection', label: 'House connection', value: formatConnectionValue(module.houseConnectionType) },
    { key: 'postFixings', label: 'Post fixings', value: formatConnectionValue(module.postConnectionType) },
  ];
}

function appendFieldLine(lines: string[], label: string, value: string | null) {
  if (!value) return;
  lines.push(`- ${label}: ${value}`);
}

function buildInputPergolaModules(
  inputs: CalculatorInputs | null,
): Array<{ id: string; label: string; modules: CalculatorModuleInputs[] }> {
  const modules = Array.isArray(inputs?.modules) ? inputs.modules : [];
  if (!modules.length) return [];

  const rawPergolas = Array.isArray((inputs as any)?.pergolas) ? ((inputs as any).pergolas as Array<{ id?: unknown; label?: unknown }>) : [];
  const pergolas = rawPergolas.length
    ? rawPergolas.map((p, idx) => ({
        id: normalizePergolaId(p?.id, `pergola-${idx + 1}`),
        label: normalizePergolaLabel(p?.label, idx),
      }))
    : [{ id: 'pergola-1', label: 'Pergola 1' }];

  const knownPergolaIds = new Set(pergolas.map((p) => p.id));
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';
  const byPergola = new Map<string, CalculatorModuleInputs[]>();
  pergolas.forEach((pergola) => byPergola.set(pergola.id, []));

  for (const module of modules) {
    const assignedId = typeof module?.pergolaId === 'string' && knownPergolaIds.has(module.pergolaId) ? module.pergolaId : fallbackPergolaId;
    const bucket = byPergola.get(assignedId);
    if (bucket) bucket.push(module);
  }

  return pergolas
    .map((pergola) => ({
      id: pergola.id,
      label: pergola.label,
      modules: byPergola.get(pergola.id) ?? [],
    }))
    .filter((pergola) => pergola.modules.length > 0);
}

function buildPergolaDescription(params: {
  label?: unknown;
  fallbackIndex: number;
  modules: CalculatorModuleInputs[];
}): string {
  const lines: string[] = [];
  const pergolaLabel = normalizePergolaLabel(params.label, params.fallbackIndex);
  const styles = uniqueModuleStyles(params.modules);
  lines.push(pergolaLabel);

  if (!params.modules.length) {
    lines.push('- Modules: snapshot-only breakdown');
    return lines.join('\n');
  }

  if (params.modules.length === 1) {
    const module = params.modules[0]!;
    appendFieldLine(lines, 'Style', formatModuleStyle(module));
    appendFieldLine(lines, 'Size', formatModuleSize(module));
    appendFieldLine(lines, 'Roof', formatModuleRoof(module));
    appendFieldLine(lines, 'Colour', formatModuleColour(module));
    appendFieldLine(lines, 'Pitch', formatModulePitch(module));
    appendFieldLine(lines, 'Posts', formatModulePosts(module));
    appendFieldLine(lines, 'House connection', formatConnectionValue(module.houseConnectionType));
    appendFieldLine(lines, 'Post fixings', formatConnectionValue(module.postConnectionType));
    return lines.join('\n');
  }

  const configurationLabel = styles.length === 1
    ? `${params.modules.length} ${styles[0]} modules`
    : `${joinStyleLabels(styles)} modules`;
  appendFieldLine(lines, 'Configuration', configurationLabel);

  const sharedFieldKeys = new Set<ModuleField['key']>();
  const sharedFields: Array<{ label: string; value: string }> = [];
  const sharedFieldMeta: Array<Pick<ModuleField, 'key' | 'label'>> = [
    { key: 'roof', label: 'Roof' },
    { key: 'colour', label: 'Colour' },
    { key: 'houseConnection', label: 'House connection' },
    { key: 'postFixings', label: 'Post fixings' },
  ];

  sharedFieldMeta.forEach(({ key, label }) => {
    const values = params.modules.map((module) => buildSharedCandidateFields(module).find((field) => field.key === key)?.value ?? null);
    if (values.some((value) => !value)) return;
    const normalized = values.map((value) => normalizeComparisonValue(value));
    if (!normalized.length || normalized.some((value) => !value || value !== normalized[0])) return;
    sharedFieldKeys.add(key);
    sharedFields.push({ label, value: values[0]! });
  });

  if (sharedFields.length) {
    lines.push('');
    lines.push('Shared specification');
    sharedFields.forEach((field) => appendFieldLine(lines, field.label, field.value));
  }

  params.modules.forEach((module, moduleIndex) => {
    lines.push('');
    const styleLabel = formatModuleStyle(module);
    lines.push(styleLabel ? `Module ${moduleIndex + 1}: ${styleLabel}` : `Module ${moduleIndex + 1}`);
    appendFieldLine(lines, 'Size', formatModuleSize(module));
    appendFieldLine(lines, 'Pitch', formatModulePitch(module));
    appendFieldLine(lines, 'Posts', formatModulePosts(module));

    buildSharedCandidateFields(module)
      .filter((field) => !sharedFieldKeys.has(field.key))
      .forEach((field) => appendFieldLine(lines, field.label, field.value));
  });

  return lines.join('\n');
}

function buildLegacyCoreDescription(modules: CalculatorModuleInputs[]): string {
  const lines: string[] = [
    'Pergola works',
    '- Legacy estimate: grouped total (no pergola split in snapshot).',
    '- Regenerate estimate to split separate pergolas (overhead differs).',
  ];

  modules.forEach((module, idx) => {
    lines.push('');
    lines.push(buildModuleDescription(module, idx));
  });

  return lines.join('\n');
}

type QuoteMappingBlockingIssue = {
  code: 'INVALID_BLIND';
  message: string;
};

type QuoteEstimateMapping = {
  items: Omit<QuoteLineItem, 'id'>[];
  coreTotalIncCents: number;
  blockingIssues: QuoteMappingBlockingIssue[];
};

export class QuoteHandoffBlockedError extends Error {
  readonly code = 'QUOTE_HANDOFF_BLOCKED';

  constructor(message: string) {
    super(message);
    this.name = 'QuoteHandoffBlockedError';
  }
}

export function isQuoteHandoffBlockedError(error: unknown): error is QuoteHandoffBlockedError {
  return error instanceof QuoteHandoffBlockedError
    || Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'QUOTE_HANDOFF_BLOCKED');
}

export function assertQuoteEstimateMappingReady(mapping: QuoteEstimateMapping): void {
  if (!mapping.blockingIssues.length) return;
  throw new QuoteHandoffBlockedError(
    `Quote handoff blocked: ${mapping.blockingIssues.map((issue) => issue.message).join(' ')}`,
  );
}

export function buildQuoteLineItemsFromEstimate(estimate: Estimate): QuoteEstimateMapping {
  const inputs = normaliseCalculatorInputs((estimate as any).inputs);
  const quoteDiscountPct = normalizeStaffQuoteDiscountPct(inputs?.quoteDiscountPct);
  const modules = inputs?.modules ?? [];
  const outputs = ((estimate as any)?.outputs ?? {}) as any;
  const snapshotPergolas = Array.isArray(outputs?.pergolas) ? outputs.pergolas : [];
  const snapshotShared = outputs?.siteShared ?? outputs?.shared ?? null;
  const inputPergolas = buildInputPergolaModules(inputs);
  const lineItems: Omit<QuoteLineItem, 'id'>[] = [];
  const blockingIssues: QuoteMappingBlockingIssue[] = [];
  let coreTotalIncCents = 0;

  if (snapshotPergolas.length > 0) {
    const pricedPergolas: PricedPergola[] = snapshotPergolas
      .map((snapshotPergola: any, idx: number): PricedPergola | null => {
        const pergolaCostEx = toNumber(snapshotPergola?.totals?.cost_ex_gst);
        if (!Number.isFinite(pergolaCostEx) || pergolaCostEx < 0) return null;
        return {
          snapshotPergola,
          idx,
          pergolaCostEx,
        };
      })
      .filter(
        (entry: PricedPergola | null): entry is PricedPergola =>
          entry !== null,
      );

    const sharedCostEx = toNumber(snapshotShared?.totals?.cost_ex_gst);
    const hasSharedCost = Boolean(snapshotShared) && Number.isFinite(sharedCostEx) && sharedCostEx >= 0;
    const showSharedLine = hasSharedCost && snapshotPergolas.length > 1 && pricedPergolas.length > 0;

    pricedPergolas.forEach(({ snapshotPergola, idx, pergolaCostEx }, pergolaIndex: number) => {
      const snapshotId = normalizePergolaId(snapshotPergola?.id, `pergola-${idx + 1}`);
      const matchingInputPergola = inputPergolas.find((p) => p.id === snapshotId) ?? inputPergolas[idx] ?? null;
      const description = buildPergolaDescription({
        label: snapshotPergola?.label ?? matchingInputPergola?.label,
        fallbackIndex: idx,
        modules: matchingInputPergola?.modules ?? [],
      });

      const lineCostEx = !showSharedLine && hasSharedCost && pergolaIndex === 0
        ? roundQuoteMoney(pergolaCostEx + sharedCostEx)
        : pergolaCostEx;

      const unitPriceIncGstCents = lineUnitPriceIncFromCostEx(lineCostEx, quoteDiscountPct);
      const qty = 1;
      const lineTotalIncGstCents = lineTotalCents(qty, unitPriceIncGstCents);
      lineItems.push({
        description: withQuoteDiscountDescription(description, quoteDiscountPct),
        qty,
        unitPriceIncGstCents,
        lineTotalIncGstCents,
        sortOrder: lineItems.length,
      });
      coreTotalIncCents += lineTotalIncGstCents;
    });

    if (showSharedLine) {
      const qty = 1;
      const unitPriceIncGstCents = lineUnitPriceIncFromCostEx(sharedCostEx, quoteDiscountPct);
      const lineTotalIncGstCents = lineTotalCents(qty, unitPriceIncGstCents);
      lineItems.push({
        description: withQuoteDiscountDescription(
          ['Site costs', '- Shared install, travel, and extras'].join('\n'),
          quoteDiscountPct,
        ),
        qty,
        unitPriceIncGstCents,
        lineTotalIncGstCents,
        sortOrder: lineItems.length,
      });
      coreTotalIncCents += lineTotalIncGstCents;
    }
  }

  if (lineItems.length === 0) {
    const legacyCoreCostEx = toNumber(outputs?.totals?.cost_ex_gst);
    const safeLegacyCoreCostEx = Number.isFinite(legacyCoreCostEx) && legacyCoreCostEx > 0 ? legacyCoreCostEx : 0;
    const unitPriceIncGstCents = lineUnitPriceIncFromCostEx(safeLegacyCoreCostEx, quoteDiscountPct);
    const qty = 1;
    lineItems.push({
      description: withQuoteDiscountDescription(buildLegacyCoreDescription(modules), quoteDiscountPct),
      qty,
      unitPriceIncGstCents,
      lineTotalIncGstCents: lineTotalCents(qty, unitPriceIncGstCents),
      sortOrder: lineItems.length,
    });
    coreTotalIncCents += lineTotalCents(qty, unitPriceIncGstCents);
  }

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
      if (priced.errors.length) {
        blockingIssues.push({
          code: 'INVALID_BLIND',
          message: `${priced.label?.trim() || `Blind ${idx + 1}`} needs valid dimensions and selections before a quote can be created.`,
        });
        return;
      }
      const qty = 1;
      const unitPrice = priced.blindSellIncCents;
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

  return { items: lineItems, coreTotalIncCents, blockingIssues };
}
