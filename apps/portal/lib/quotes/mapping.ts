import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
  normalizeBlindsState,
} from '@/lib/types/calculator';
import type { Estimate } from '@/lib/types/estimate';
import { priceAllBlinds, type BlindLineItemInput } from '@/lib/costing/blinds';
import type { QuoteLineItem } from './types';
import { GST_RATE, lineTotalCents, toCents } from './utils';

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

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
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

function lineUnitPriceIncFromCostEx(costEx: number): number {
  const sellEx = roundMoney(costEx * 1.25);
  const sellInc = roundMoney(sellEx * (1 + GST_RATE));
  return toCents(sellInc);
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
  lines.push(pergolaLabel);

  if (!params.modules.length) {
    lines.push('- Modules: snapshot-only breakdown');
    return lines.join('\n');
  }

  params.modules.forEach((module, moduleIndex) => {
    lines.push('');
    lines.push(buildModuleDescription(module, moduleIndex));
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

export function buildQuoteLineItemsFromEstimate(estimate: Estimate): { items: Omit<QuoteLineItem, 'id'>[]; coreTotalIncCents: number } {
  const inputs = normaliseCalculatorInputs((estimate as any).inputs);
  const modules = inputs?.modules ?? [];
  const outputs = ((estimate as any)?.outputs ?? {}) as any;
  const snapshotPergolas = Array.isArray(outputs?.pergolas) ? outputs.pergolas : [];
  const snapshotShared = outputs?.siteShared ?? outputs?.shared ?? null;
  const inputPergolas = buildInputPergolaModules(inputs);
  const lineItems: Omit<QuoteLineItem, 'id'>[] = [];
  let coreTotalIncCents = 0;

  if (snapshotPergolas.length > 0) {
    snapshotPergolas.forEach((snapshotPergola: any, idx: number) => {
      const pergolaCostEx = toNumber(snapshotPergola?.totals?.cost_ex_gst);
      if (!Number.isFinite(pergolaCostEx) || pergolaCostEx < 0) return;

      const snapshotId = normalizePergolaId(snapshotPergola?.id, `pergola-${idx + 1}`);
      const matchingInputPergola = inputPergolas.find((p) => p.id === snapshotId) ?? inputPergolas[idx] ?? null;
      const description = buildPergolaDescription({
        label: snapshotPergola?.label ?? matchingInputPergola?.label,
        fallbackIndex: idx,
        modules: matchingInputPergola?.modules ?? [],
      });

      const unitPriceIncGstCents = lineUnitPriceIncFromCostEx(pergolaCostEx);
      const qty = 1;
      const lineTotalIncGstCents = lineTotalCents(qty, unitPriceIncGstCents);
      lineItems.push({
        description,
        qty,
        unitPriceIncGstCents,
        lineTotalIncGstCents,
        sortOrder: lineItems.length,
      });
      coreTotalIncCents += lineTotalIncGstCents;
    });

    const sharedCostEx = toNumber(snapshotShared?.totals?.cost_ex_gst);
    if (snapshotShared && Number.isFinite(sharedCostEx) && sharedCostEx >= 0) {
      const qty = 1;
      const unitPriceIncGstCents = lineUnitPriceIncFromCostEx(sharedCostEx);
      const lineTotalIncGstCents = lineTotalCents(qty, unitPriceIncGstCents);
      lineItems.push({
        description: ['Site costs', '- Shared install, travel, and extras'].join('\n'),
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
    const unitPriceIncGstCents = lineUnitPriceIncFromCostEx(safeLegacyCoreCostEx);
    const qty = 1;
    lineItems.push({
      description: buildLegacyCoreDescription(modules),
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
