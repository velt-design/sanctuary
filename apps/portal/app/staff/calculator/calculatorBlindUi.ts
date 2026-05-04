import type { BlindFabric, BlindLineItem, BlindSystemType } from '@/lib/types/calculator';
import {
  priceAllBlinds,
  type BlindLineItemInput,
  type BlindLineItemPricing,
  type BlindPricingResult,
} from '@/lib/costing/blinds';
import { toNumber } from './calculatorInputs';

type BlindOption<T extends string> = {
  label: string;
  value: T;
};

export const BLIND_SYSTEM_OPTIONS: Array<BlindOption<BlindSystemType>> = [
  { label: 'Ziptrak', value: 'ZIPTRAK' },
  { label: 'Omni', value: 'OMNI' },
];

export const BLIND_FABRIC_OPTIONS: Array<BlindOption<BlindFabric>> = [
  { label: 'Mesh', value: 'MESH' },
  { label: 'PVC', value: 'PVC' },
  { label: 'Fine mesh', value: 'FINE_MESH' },
  { label: 'None (Mesh)', value: 'NONE' },
];

type BlindStatusTone = 'error' | 'helper';

type BlindRowViewModel = {
  item: BlindLineItem;
  pricing: BlindLineItemPricing | undefined;
  errors: string[];
  hasErrors: boolean;
  isMissingDims: boolean;
  isPriceable: boolean;
  showStatus: boolean;
  statusMessage: string;
  statusTone: BlindStatusTone;
  totalExLabel: string;
  totalIncLabel: string;
};

type CalculatorBlindsUi = {
  inputs: BlindLineItemInput[];
  pricing: BlindPricingResult;
  rows: BlindRowViewModel[];
  totals: BlindPricingResult['totals'];
  totalEx: number;
  totalInc: number;
  totalExLabel: string;
  totalIncLabel: string;
  summaryText: string;
};

function formatCents(cents?: number): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildBlindInputs(items: BlindLineItem[]): BlindLineItemInput[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    system: item.system as BlindSystemType,
    widthMm: Number.isFinite(toNumber(item.widthMm)) ? toNumber(item.widthMm) : null,
    coverLengthMm: Number.isFinite(toNumber(item.coverLengthMm)) ? toNumber(item.coverLengthMm) : null,
    fabric: item.fabric as BlindFabric,
    motorised: item.motorised === 'YES' ? true : null,
  }));
}

function statusMessageForErrors(errors: string[]): string {
  const isMissingDims = errors.some((err) => err.toLowerCase().includes('enter width'));
  if (isMissingDims) return 'Enter dimensions to price this blind.';
  if (errors.some((err) => err.toLowerCase().includes('max width'))) return 'Add another blind and split widths manually.';
  if (errors.some((err) => err.toLowerCase().includes('max cover length'))) return 'Manual quote required.';
  return errors[0] ?? '';
}

export function buildCalculatorBlindsUi(items: BlindLineItem[]): CalculatorBlindsUi {
  const inputs = buildBlindInputs(items);
  const pricing = priceAllBlinds(inputs);
  const rows = items.map((item) => {
    const priced = pricing.items.find((entry) => entry.id === item.id);
    const errors = priced?.errors ?? [];
    const isMissingDims = errors.some((err) => err.toLowerCase().includes('enter width'));
    const hasErrors = errors.length > 0;
    const statusMessage = statusMessageForErrors(errors);
    const isPriceable = priced ? priced.errors.length === 0 : false;
    const statusTone: BlindStatusTone = hasErrors && !isMissingDims ? 'error' : 'helper';
    return {
      item,
      pricing: priced,
      errors,
      hasErrors,
      isMissingDims,
      isPriceable,
      showStatus: Boolean(statusMessage),
      statusMessage,
      statusTone,
      totalExLabel: isPriceable ? formatCents(priced?.blindSellExCents ?? 0) : '—',
      totalIncLabel: isPriceable ? formatCents(priced?.blindSellIncCents ?? 0) : '—',
    };
  });
  const totals = pricing.totals;
  return {
    inputs,
    pricing,
    rows,
    totals,
    totalEx: totals ? totals.totalExCents / 100 : 0,
    totalInc: totals ? totals.totalIncCents / 100 : 0,
    totalExLabel: formatCents(totals?.totalExCents ?? 0),
    totalIncLabel: formatCents(totals?.totalIncCents ?? 0),
    summaryText: `${items.length} blind${items.length === 1 ? '' : 's'} · totals update live`,
  };
}
