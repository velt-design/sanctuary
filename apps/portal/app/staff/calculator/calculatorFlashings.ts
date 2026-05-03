import type { CalculatorFlashingBand, CalculatorFlashingPurpose, CalculatorFlashingsState, CalculatorModuleInputs } from '@/lib/types/calculator';
import { getRoofTypeForModule, toNumber } from './calculatorInputs';

const FLASHING_AUTO_SYNC_TOLERANCE_M = 0.01;

export function normalizeFlashingBand(value: unknown): CalculatorFlashingBand {
  if (value === '201-300' || value === '301-400') return value;
  return '0-200';
}

export function normalizeFlashingPurpose(value: unknown): CalculatorFlashingPurpose {
  if (value === 'HEAD' || value === 'SIDE' || value === 'APRON') return value;
  return 'CUSTOM';
}

export function makeFlashingId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `flashing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function roofLengthForPrimaryFlashing(module: CalculatorModuleInputs): number {
  const lengthM = Number.isFinite(toNumber(module.lengthM)) ? Math.max(0, toNumber(module.lengthM)) : 0;
  if (module.pergolaStyle !== 'hip_corner') return lengthM;
  const lengthBM = Number.isFinite(toNumber(module.hipCornerLengthBM)) ? Math.max(0, toNumber(module.hipCornerLengthBM)) : 0;
  return lengthM + lengthBM;
}

function defaultPrimaryFlashingBandForModule(module: CalculatorModuleInputs): CalculatorFlashingBand {
  const roofType = getRoofTypeForModule(module);
  if (roofType === 'gable' || roofType === 'low_gable') return '301-400';
  return '201-300';
}

function primaryFlashingDefaultKeyForModule(module: CalculatorModuleInputs): string {
  const roofType = getRoofTypeForModule(module);
  if (roofType === 'pitched') return 'pitched_primary';
  if (roofType === 'gable' || roofType === 'low_gable') return 'gable_ridge';
  if (roofType === 'hip') return 'hip_ledger';
  return 'roof_primary';
}

export function formatFlashingLengthInput(lengthM: number): string {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return '1.0';
  const rounded = Math.round(lengthM * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '') || '1.0';
}

export function isPrimaryFlashingLengthAutoLinked(lengthInput: string, module: CalculatorModuleInputs): boolean {
  const trimmed = String(lengthInput ?? '').trim();
  if (!trimmed) return true;
  const parsed = toNumber(trimmed);
  if (!Number.isFinite(parsed)) return true;
  const autoLength = roofLengthForPrimaryFlashing(module);
  return Math.abs(parsed - autoLength) <= FLASHING_AUTO_SYNC_TOLERANCE_M;
}

export function makeDefaultPrimaryFlashingRow(module: CalculatorModuleInputs): CalculatorFlashingsState['rows'][number] {
  return {
    id: makeFlashingId(),
    kind: 'primary',
    band: defaultPrimaryFlashingBandForModule(module),
    lengthM: formatFlashingLengthInput(roofLengthForPrimaryFlashing(module)),
    purpose: 'CUSTOM',
  };
}

export function makeDefaultFlashings(module: CalculatorModuleInputs): CalculatorFlashingsState {
  return { rows: [makeDefaultPrimaryFlashingRow(module)] };
}

export function normalizeFlashingsStateForUi(value: unknown, module: CalculatorModuleInputs): CalculatorFlashingsState {
  const defaultPrimary = makeDefaultPrimaryFlashingRow(module);
  if (!value || typeof value !== 'object') return { rows: [defaultPrimary] };
  const source = value as Record<string, unknown>;

  const rowsRaw = Array.isArray(source.rows) ? source.rows : null;
  if (rowsRaw) {
    const normalizedRows = rowsRaw
      .filter((item: unknown) => item && typeof item === 'object')
      .map((item: unknown) => {
        const record = item as Record<string, unknown>;
        const idRaw = typeof record.id === 'string' ? record.id.trim() : '';
        const kind = record.kind === 'primary' ? 'primary' : 'extra';
        return {
          id: idRaw || makeFlashingId(),
          kind,
          band: normalizeFlashingBand(record.band),
          lengthM: String(record.lengthM ?? ''),
          purpose: normalizeFlashingPurpose(record.purpose),
        };
      });

    const primary =
      normalizedRows.find((row) => row.kind === 'primary') ??
      ({
        ...defaultPrimary,
      } as CalculatorFlashingsState['rows'][number]);
    const extras = normalizedRows.filter((row) => row.kind !== 'primary').map((row) => ({ ...row, kind: 'extra' as const }));

    return {
      rows: [
        {
          ...primary,
          kind: 'primary',
          lengthM: String(primary.lengthM ?? '').trim() ? String(primary.lengthM) : defaultPrimary.lengthM,
          purpose: normalizeFlashingPurpose(primary.purpose),
        },
        ...extras,
      ],
    };
  }

  const defaultBandsRaw = source.defaultBands;
  const primaryLegacyBandRaw =
    defaultBandsRaw && typeof defaultBandsRaw === 'object'
      ? (defaultBandsRaw as Record<string, unknown>)[primaryFlashingDefaultKeyForModule(module)]
      : undefined;
  const primaryBand = primaryLegacyBandRaw === 'none' ? defaultPrimary.band : normalizeFlashingBand(primaryLegacyBandRaw ?? defaultPrimary.band);
  const primaryLengthM = primaryLegacyBandRaw === 'none' ? '0' : defaultPrimary.lengthM;

  const legacyExtrasRaw = Array.isArray(source.extras) ? source.extras : [];
  const extras = legacyExtrasRaw
    .filter((item: unknown) => item && typeof item === 'object')
    .map((item: unknown) => {
      const record = item as Record<string, unknown>;
      const idRaw = typeof record.id === 'string' ? record.id.trim() : '';
      return {
        id: idRaw || makeFlashingId(),
        kind: 'extra' as const,
        band: normalizeFlashingBand(record.band),
        lengthM: String(record.lengthM ?? ''),
        purpose: normalizeFlashingPurpose(record.purpose),
      };
    });

  return {
    rows: [{ ...defaultPrimary, band: primaryBand, lengthM: primaryLengthM }, ...extras],
  };
}
