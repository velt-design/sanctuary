import type { EstimateSummary } from './types';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function toIsoDate(value: unknown): string | null {
  const raw = toStringValue(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.valueOf())) return null;
  return parsed.toISOString();
}

function readPath(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = (cursor as AnyRecord)[key];
  }
  return cursor;
}

function readNumber(source: unknown, path: string[]): number | null {
  return toNumber(readPath(source, path));
}

function readString(source: unknown, path: string[]): string | null {
  return toStringValue(readPath(source, path));
}

function firstNumber(...values: Array<number | null>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function firstString(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function summarizeCalculatorSnapshot(snapshot: unknown): EstimateSummary {
  if (!isRecord(snapshot)) return {};
  const root = (isRecord((snapshot as AnyRecord).calculator_snapshot)
    ? (snapshot as AnyRecord).calculator_snapshot
    : snapshot) as AnyRecord;

  const summaryObj = isRecord(root.summary) ? (root.summary as AnyRecord) : null;
  const outputs = isRecord(root.outputs) ? (root.outputs as AnyRecord) : null;
  const totals = outputs && isRecord(outputs.totals) ? (outputs.totals as AnyRecord) : null;

  const total = firstNumber(
    readNumber(summaryObj, ['total']),
    readNumber(summaryObj, ['totalIncGst']),
    readNumber(summaryObj, ['total_inc_gst']),
    readNumber(summaryObj, ['totalExGst']),
    readNumber(summaryObj, ['total_ex_gst']),
    readNumber(root, ['total_true_cost_inc_gst']),
    readNumber(root, ['total_true_cost_ex_gst']),
    readNumber(totals, ['cost_inc_gst']),
    readNumber(totals, ['cost_ex_gst']),
  );

  const cost = firstNumber(
    readNumber(summaryObj, ['cost']),
    readNumber(summaryObj, ['costExGst']),
    readNumber(summaryObj, ['cost_ex_gst']),
    readNumber(root, ['total_true_cost_ex_gst']),
    readNumber(totals, ['cost_ex_gst']),
  );

  let marginValue = firstNumber(
    readNumber(summaryObj, ['marginValue']),
    readNumber(summaryObj, ['margin_value']),
    readNumber(summaryObj, ['margin']),
  );

  let marginPct = firstNumber(
    readNumber(summaryObj, ['marginPct']),
    readNumber(summaryObj, ['margin_pct']),
    readNumber(summaryObj, ['marginPercent']),
    readNumber(summaryObj, ['margin_percent']),
  );

  if (marginValue === null && typeof total === 'number' && typeof cost === 'number') {
    marginValue = total - cost;
  }

  if (marginPct === null && typeof total === 'number' && typeof marginValue === 'number') {
    marginPct = total === 0 ? 0 : (marginValue / total) * 100;
  }

  const deposit = firstNumber(
    readNumber(summaryObj, ['deposit']),
    readNumber(summaryObj, ['depositAmount']),
    readNumber(summaryObj, ['deposit_ex_gst']),
    readNumber(summaryObj, ['depositExGst']),
  );

  const validityDate = firstString(
    toIsoDate(readPath(summaryObj, ['validityDate'])),
    toIsoDate(readPath(summaryObj, ['validUntil'])),
    toIsoDate(readPath(summaryObj, ['valid_until'])),
    toIsoDate(readPath(root, ['validityDate'])),
    toIsoDate(readPath(root, ['validUntil'])),
  );

  const leadTime = firstString(
    readString(summaryObj, ['leadTime']),
    readString(summaryObj, ['lead_time']),
    readString(root, ['leadTime']),
    readString(root, ['lead_time']),
  );

  return {
    total: round2(total),
    cost: round2(cost),
    marginPct: round2(marginPct),
    marginValue: round2(marginValue),
    deposit: round2(deposit),
    validityDate: validityDate ?? null,
    leadTime: leadTime ?? null,
  };
}
