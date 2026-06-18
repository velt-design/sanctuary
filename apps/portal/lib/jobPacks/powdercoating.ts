import type { PowdercoatLine } from '@/lib/outputs/types';
import type { JobPackPowdercoatOption, JobPackPowdercoatStoredRow } from './types';

export function normalizePowdercoatProfile(value: string): string {
  return String(value ?? '')
    .replace(/[×]/g, 'x')
    .replace(/\s*x\s*/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePowdercoatColour(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizePowdercoatUnit(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function buildPowdercoatBaseRowId(input: {
  profile: string;
  colour: string;
  stockLengthM: number | null | undefined;
  unit: string;
}): string {
  const profile = normalizePowdercoatProfile(input.profile);
  const colour = normalizePowdercoatColour(input.colour);
  const unit = normalizePowdercoatUnit(input.unit);
  const stockLength = typeof input.stockLengthM === 'number' && Number.isFinite(input.stockLengthM) ? input.stockLengthM : 0;
  return `base:${profile}|${colour}|${stockLength}|${unit}`;
}

export function powdercoatStoredRowFromLine(line: PowdercoatLine): JobPackPowdercoatStoredRow {
  return {
    id: buildPowdercoatBaseRowId({
      profile: line.profile,
      colour: line.colour,
      stockLengthM: line.stock_length_m,
      unit: line.unit,
    }),
    source: 'base',
    baseRowId: buildPowdercoatBaseRowId({
      profile: line.profile,
      colour: line.colour,
      stockLengthM: line.stock_length_m,
      unit: line.unit,
    }),
    profile: normalizePowdercoatProfile(line.profile),
    colour: normalizePowdercoatColour(line.colour),
    stockLengthM: typeof line.stock_length_m === 'number' && Number.isFinite(line.stock_length_m) ? line.stock_length_m : null,
    qty: typeof line.qty === 'number' && Number.isFinite(line.qty) ? line.qty : 0,
    unit: normalizePowdercoatUnit(line.unit),
    notes: String(line.notes ?? '').trim(),
  };
}

export function normalizePowdercoatStoredRow(value: unknown): JobPackPowdercoatStoredRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const source = row.source === 'manual' ? 'manual' : row.source === 'base' ? 'base' : null;
  const baseRowId = typeof row.baseRowId === 'string' && row.baseRowId.trim() ? row.baseRowId.trim() : null;
  const profile = normalizePowdercoatProfile(typeof row.profile === 'string' ? row.profile : '');
  const colour = normalizePowdercoatColour(typeof row.colour === 'string' ? row.colour : '');
  const stockLengthRaw = row.stockLengthM;
  const stockLengthM =
    typeof stockLengthRaw === 'number' && Number.isFinite(stockLengthRaw) && stockLengthRaw > 0
      ? Math.round(stockLengthRaw * 1000) / 1000
      : null;
  const qtyRaw = row.qty;
  const qty =
    typeof qtyRaw === 'number' && Number.isFinite(qtyRaw) && qtyRaw > 0
      ? Math.round(qtyRaw * 1000) / 1000
      : typeof qtyRaw === 'string' && qtyRaw.trim()
        ? Number.parseFloat(qtyRaw)
        : NaN;
  const unit = normalizePowdercoatUnit(typeof row.unit === 'string' ? row.unit : '');
  const notes = typeof row.notes === 'string' ? row.notes.trim() : '';

  if (!id || !source || !profile || !Number.isFinite(qty) || qty <= 0 || !unit) return null;
  if (source === 'base' && !baseRowId) return null;

  return {
    id,
    source,
    baseRowId,
    profile,
    colour,
    stockLengthM,
    qty: Math.round(qty * 1000) / 1000,
    unit,
    notes,
  };
}

export function summarizePowdercoatChanges(
  baseRow: JobPackPowdercoatStoredRow | null,
  currentRow: JobPackPowdercoatStoredRow,
): string | null {
  if (!baseRow || currentRow.source === 'manual') return 'Added manually';

  const changes: string[] = [];
  if (normalizePowdercoatProfile(baseRow.profile) !== normalizePowdercoatProfile(currentRow.profile)) {
    changes.push(`Profile ${baseRow.profile} -> ${currentRow.profile}`);
  }
  if ((baseRow.stockLengthM ?? null) !== (currentRow.stockLengthM ?? null)) {
    const before = typeof baseRow.stockLengthM === 'number' ? `${baseRow.stockLengthM}m` : '-';
    const after = typeof currentRow.stockLengthM === 'number' ? `${currentRow.stockLengthM}m` : '-';
    changes.push(`Stock ${before} -> ${after}`);
  }
  if (baseRow.qty !== currentRow.qty) {
    changes.push(`Qty ${baseRow.qty} -> ${currentRow.qty}`);
  }
  return changes.length ? changes.join(', ') : null;
}

export function buildPowdercoatOptionMap(options: JobPackPowdercoatOption[]): Map<string, JobPackPowdercoatOption> {
  return new Map(options.map((option) => [normalizePowdercoatProfile(option.profile), option]));
}
