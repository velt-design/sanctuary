import type { SiteOutputV1 } from '@sp/costing';
import { hasPricingAffectingCalculatorInputChanges } from '@/lib/estimates/costingPayload';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { calculatorInputsFromEstimateDetail } from './calculatorInputs';

type AnyRecord = Record<string, unknown>;

export type CalculatorCostingBasis = {
  materialsEx: number | null;
  installEx: number | null;
  overheadEx: number | null;
  trueCostEx: number | null;
  trueCostInc: number | null;
};

type CalculatorCostingDifference = CalculatorCostingBasis;

export type CalculatorPricingComparison = {
  stored: CalculatorCostingBasis | null;
  live: CalculatorCostingBasis | null;
  difference: CalculatorCostingDifference | null;
  pricingInputsChanged: boolean;
  storedPricingState: 'current' | 'stale' | 'unknown';
};

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function unwrapSnapshot(snapshot: unknown): AnyRecord | null {
  if (!isRecord(snapshot)) return null;
  return isRecord(snapshot.calculator_snapshot) ? snapshot.calculator_snapshot : snapshot;
}

function readNumber(source: unknown, path: string[]): number | null {
  let cursor = source;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = cursor[key];
  }
  if (typeof cursor === 'number' && Number.isFinite(cursor)) return cursor;
  if (typeof cursor !== 'string' || !cursor.trim()) return null;
  const parsed = Number.parseFloat(cursor);
  return Number.isFinite(parsed) ? parsed : null;
}

function subtract(stored: number | null, live: number | null): number | null {
  return stored === null || live === null ? null : live - stored;
}

export function extractStoredCalculatorCosting(estimate: EstimateDetail | null): CalculatorCostingBasis | null {
  const snapshot = unwrapSnapshot(estimate?.calculatorSnapshot);
  if (!snapshot) return null;
  const outputs = isRecord(snapshot.outputs) ? snapshot.outputs : null;

  const costing = {
    materialsEx: readNumber(outputs, ['materials', 'totals', 'materials_ex_gst']),
    installEx: readNumber(outputs, ['install', 'totals', 'install_ex_gst']),
    overheadEx:
      readNumber(outputs, ['overhead', 'total_ex_gst']) ?? readNumber(outputs, ['overhead', 'ops_ex_gst']),
    trueCostEx:
      readNumber(outputs, ['totals', 'cost_ex_gst']) ??
      readNumber(snapshot, ['total_true_cost_ex_gst']) ??
      estimate?.summary.cost ??
      null,
    trueCostInc:
      readNumber(outputs, ['totals', 'cost_inc_gst']) ??
      readNumber(snapshot, ['total_true_cost_inc_gst']) ??
      estimate?.summary.total ??
      null,
  } satisfies CalculatorCostingBasis;

  return Object.values(costing).some((value) => value !== null) ? costing : null;
}

function extractLiveCalculatorCosting(result: SiteOutputV1 | null): CalculatorCostingBasis | null {
  if (!result) return null;
  return {
    materialsEx: result.materials?.totals?.materials_ex_gst ?? null,
    installEx: result.install?.totals?.install_ex_gst ?? null,
    overheadEx: result.overhead?.total_ex_gst ?? null,
    trueCostEx: result.totals?.cost_ex_gst ?? null,
    trueCostInc: result.totals?.cost_inc_gst ?? null,
  };
}

function resolveStoredPricingState(estimate: EstimateDetail | null): CalculatorPricingComparison['storedPricingState'] {
  const snapshot = unwrapSnapshot(estimate?.calculatorSnapshot);
  const outputs = snapshot && isRecord(snapshot.outputs) ? snapshot.outputs : null;
  const value = outputs?.pricing_sync_state;
  return value === 'current' || value === 'stale' ? value : 'unknown';
}

function pricingInputsChanged(estimate: EstimateDetail | null, values: CalculatorInputs): boolean {
  if (!estimate) return false;
  try {
    return hasPricingAffectingCalculatorInputChanges(calculatorInputsFromEstimateDetail(estimate), values);
  } catch {
    return false;
  }
}

export function buildCalculatorPricingComparison(input: {
  estimate: EstimateDetail | null;
  values: CalculatorInputs;
  liveResult: SiteOutputV1 | null;
}): CalculatorPricingComparison {
  const stored = extractStoredCalculatorCosting(input.estimate);
  const live = extractLiveCalculatorCosting(input.liveResult);
  return {
    stored,
    live,
    difference:
      stored && live
        ? {
            materialsEx: subtract(stored.materialsEx, live.materialsEx),
            installEx: subtract(stored.installEx, live.installEx),
            overheadEx: subtract(stored.overheadEx, live.overheadEx),
            trueCostEx: subtract(stored.trueCostEx, live.trueCostEx),
            trueCostInc: subtract(stored.trueCostInc, live.trueCostInc),
          }
        : null,
    pricingInputsChanged: pricingInputsChanged(input.estimate, input.values),
    storedPricingState: resolveStoredPricingState(input.estimate),
  };
}

export function formatCalculatorCostMoney(value: number | null, options?: { signed?: boolean }): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const sign = options?.signed && normalized > 0 ? '+' : '';
  const absoluteSign = options?.signed && normalized < 0 ? '-' : '';
  return `${sign}${absoluteSign}$${Math.abs(normalized).toFixed(2)}`;
}
