import type { CalculatorInputs } from '@/lib/types/calculator';
import {
  getBlindRollCoverRateIncCents,
  normalizeBlindRollCover,
  type BlindLineItemInput,
  type BlindLineItemPricing,
} from '@sp/costing';

function formatBlindWidthMetres(widthMm: number | null): string {
  if (!Number.isFinite(widthMm ?? NaN)) return 'Not specified';
  return (Number(widthMm) / 1000).toFixed(3).replace(/\.?0+$/, '');
}

function formatBlindDimension(valueMm: number | null): string {
  if (!Number.isFinite(valueMm ?? NaN)) return 'Not specified';
  return new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 0 }).format(Math.round(Number(valueMm)));
}

function formatBlindHeading(label: string | undefined, index: number): string {
  const clean = label?.trim();
  if (!clean) return `Blind ${index + 1}`;
  return /\bblind\b/i.test(clean) ? clean : `${clean} blind`;
}

function formatBlindSystem(system: BlindLineItemInput['system']): string {
  return system === 'ZIPTRAK' ? 'Ziptrak' : 'Omni';
}

function formatBlindFabric(fabric: BlindLineItemInput['fabric']): string {
  if (fabric === 'FINE_MESH') return 'Fine mesh';
  if (fabric === 'MESH') return 'Mesh';
  if (fabric === 'PVC') return 'PVC';
  return 'Not specified';
}

function formatBlindRollCover(item: BlindLineItemInput, pricing?: BlindLineItemPricing): string {
  const rollCover = normalizeBlindRollCover(item.rollCover);
  if (rollCover === 'NONE') return 'Not included';
  const label = rollCover === 'FLASHING' ? 'Flashing' : 'Pelmet';
  const rate = getBlindRollCoverRateIncCents(rollCover) / 100;
  const amount = (pricing?.rollCoverIncCents ?? 0) / 100;
  return `${label}, ${formatBlindWidthMetres(item.widthMm)}m at $${rate.toFixed(0)}/m; $${amount.toFixed(2)} incl GST`;
}

export function buildBlindDescription(
  item: BlindLineItemInput,
  index: number,
  label?: string,
  errors?: string[],
  pricing?: BlindLineItemPricing,
): string {
  const lines = [
    formatBlindHeading(label, index),
    '- Custom-sized blind system',
    `- System: ${formatBlindSystem(item.system)}`,
    `- Dimensions: ${Number.isFinite(item.widthMm ?? NaN) && Number.isFinite(item.coverLengthMm ?? NaN) ? `${formatBlindDimension(item.widthMm)}mm wide × ${formatBlindDimension(item.coverLengthMm)}mm drop` : 'To be confirmed'}`,
    `- Fabric: ${formatBlindFabric(item.fabric)}`,
    `- Operation: ${item.motorised ? 'Motorised' : 'Manual'}`,
    `- Roll cover: ${formatBlindRollCover(item, pricing)}`,
  ];
  if (errors?.length) lines.push(`- ${errors.join(' ')}`);
  return lines.join('\n');
}

function formatStandaloneInfillSize(
  item: NonNullable<CalculatorInputs['standaloneInfills']>['items'][number],
): string {
  const width = item.shape?.widthM?.trim() || 'Not specified';
  const dimensions = [item.shape?.widthM, ...(item.shape?.type === 'rect' ? [item.shape.heightM] : [item.shape?.heightLowM, item.shape?.heightHighM])];
  if (dimensions.some((value) => !value?.trim())) return 'Dimensions to be confirmed';
  if (item.shape?.type === 'rect') {
    return `${width}m × ${item.shape.heightM?.trim() || 'Not specified'}m`;
  }
  const low = item.shape?.heightLowM?.trim() || 'Not specified';
  const high = item.shape?.heightHighM?.trim() || 'Not specified';
  return `${width}m × ${low}–${high}m high`;
}

type FinishState = {
  extrusionColour?: string;
  powdercoatIsCustom?: boolean;
  powdercoatCustomColour?: string;
  powdercoatStandardColour?: string;
};

function formatFinish(state: FinishState | undefined): string {
  if (state?.extrusionColour !== 'Mill') return state?.extrusionColour ?? 'Black';
  if (state.powdercoatIsCustom) return state.powdercoatCustomColour?.trim() || 'Custom powdercoat';
  return state.powdercoatStandardColour?.trim() || 'Powdercoat';
}

export function buildStandaloneInfillsDescription(inputs: CalculatorInputs | null): string {
  const state = inputs?.standaloneInfills;
  const items = state?.items ?? [];
  return [
    'Custom infills for existing pergola',
    '- Custom-made acrylic infills, supplied and installed',
    `- Frame finish: ${formatFinish(state)}`,
    ...items.map((item, index) => {
      const label = item.label?.trim() || `Infill ${index + 1}`;
      return `- ${label}: ${formatStandaloneInfillSize(item)}${Number(item.qty) > 1 ? `; quantity ${item.qty}` : ''}`;
    }),
    '- Existing pergola structure excluded',
  ].join('\n');
}

export function buildAdditionalAluminiumDescription(inputs: CalculatorInputs | null, itemCount: number): string {
  const state = inputs?.additionalAluminium;
  const rows = state?.rows ?? [];
  const details = rows.map((row, index) => {
    const compatibilityRow = row as typeof row & { profileSku?: string };
    const profile = row.profile?.trim() || compatibilityRow.profileSku?.trim() || `Specified profile ${index + 1}`;
    const stockLength = row.stockLengthM?.trim();
    const quantity = Number(row.quantity) > 0 ? Number(row.quantity) : 1;
    if (stockLength) {
      return `- ${quantity} × ${stockLength}m length${quantity === 1 ? '' : 's'}: ${profile}`;
    }
    return `- ${quantity} × specified aluminium length${quantity === 1 ? '' : 's'}: ${profile}`;
  });
  if (!details.length) {
    details.push(`- ${itemCount} specified aluminium item${itemCount === 1 ? '' : 's'}`);
  }
  return [
    'Aluminium supply only',
    `- Frame finish: ${formatFinish(state)}`,
    ...details,
    '- Materials supplied; installation excluded',
  ].join('\n');
}

export function buildApprovalDescription(requirement: 'engineering_required' | 'full_building_consent'): string {
  if (requirement === 'full_building_consent') {
    return [
      'Design, engineering and consent documentation',
      '- Design and documentation allowance for building consent',
      '- Structural engineering calculations',
      "- Engineer's PS1 documentation",
      '- Full shop drawing set for the pergola structure',
      '- Consent documentation support',
      '- Responses to council RFIs relating to the pergola structure',
      "- Builder's PS3 on completion",
      '- Coordination with the engineer, as required',
    ].join('\n');
  }
  return [
    'Project engineering allowance',
    '- Allowance for professional engineering',
    '- Final requirements depend on the completed design and site conditions',
  ].join('\n');
}

export function buildLightingDescription(lighting: {
  label?: string;
  lightCount: number;
  driverCount: number;
  dimmer: boolean;
}): string {
  const label = lighting.label?.trim();
  return [
    `${label ? `${label} ` : ''}integrated rafter lighting`,
    '- Rafter-integrated lights, supplied and installed',
    `- Lights: ${lighting.lightCount} rafter light${lighting.lightCount === 1 ? '' : 's'}`,
    `- Drivers: ${lighting.driverCount}`,
    ...(lighting.dimmer ? ['- Control: Dimming included'] : []),
  ].join('\n');
}

export function buildHistoricalLightingDescription(): string {
  return [
    'Lighting allowance',
    '- Final fittings and controls require confirmation',
  ].join('\n');
}
