import type {
  CalculatorFlashingBand,
  CalculatorFlashingPurpose,
  CalculatorFlashingsState,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';

export const FLASHING_BANDS: CalculatorFlashingBand[] = ['0-200', '201-300', '301-400'];

export const FLASHING_BAND_OPTIONS: Array<{ label: string; value: CalculatorFlashingBand }> = [
  { label: '0-200', value: '0-200' },
  { label: '201-300', value: '201-300' },
  { label: '301-400', value: '301-400' },
];

export const FLASHING_PURPOSE_OPTIONS: Array<{ label: string; value: CalculatorFlashingPurpose }> = [
  { label: 'Head', value: 'HEAD' },
  { label: 'Side', value: 'SIDE' },
  { label: 'Apron', value: 'APRON' },
  { label: 'Custom', value: 'CUSTOM' },
];

const FLASHING_AUTO_SYNC_TOLERANCE_M = 0.05;

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getRoofTypeForModule(module: CalculatorModuleInputs): 'pitched' | 'gable' | 'hip' | 'hip_corner' {
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  return 'pitched';
}

function normalizeFlashingBand(value: unknown): CalculatorFlashingBand {
  if (value === '201-300' || value === '301-400') return value;
  return '0-200';
}

function normalizeFlashingPurpose(value: unknown): CalculatorFlashingPurpose {
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
  if (roofType === 'gable') return '301-400';
  return '201-300';
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

function makeDefaultPrimaryFlashingRow(module: CalculatorModuleInputs): CalculatorFlashingsState['rows'][number] {
  return {
    id: makeFlashingId(),
    kind: 'primary',
    band: defaultPrimaryFlashingBandForModule(module),
    lengthM: formatFlashingLengthInput(roofLengthForPrimaryFlashing(module)),
    purpose: 'CUSTOM',
  };
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
        band: normalizedRows[0]?.band ?? defaultPrimary.band,
        lengthM: normalizedRows[0]?.lengthM ?? defaultPrimary.lengthM,
        purpose: normalizeFlashingPurpose(normalizedRows[0]?.purpose),
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

  return { rows: [defaultPrimary] };
}
