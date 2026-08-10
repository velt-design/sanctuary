import type { CalculatorFlashingBand, CalculatorFlashingPurpose, CalculatorFlashingsState, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  getPitchForModule,
  getRoofTypeForModule,
  normalizeFlashingBand,
  roofLengthForPrimaryFlashing,
  toNumber,
} from './calculatorInputs';

const FLASHING_EDGE_ALLOWANCE_M = 0.1;
const FLASHING_DUPLICATE_TOLERANCE_M = 0.01;

type FlashingOption<T extends string> = {
  label: string;
  value: T;
};

const FLASHING_BANDS: CalculatorFlashingBand[] = ['0-200', '201-300', '301-400'];

export const FLASHING_BAND_OPTIONS: Array<FlashingOption<CalculatorFlashingBand>> = [
  { label: '0-200mm', value: '0-200' },
  { label: '201-300mm', value: '201-300' },
  { label: '301-400mm', value: '301-400' },
];

export const FLASHING_PURPOSE_OPTIONS: Array<FlashingOption<CalculatorFlashingPurpose>> = [
  { label: 'Head', value: 'HEAD' },
  { label: 'Side', value: 'SIDE' },
  { label: 'Apron', value: 'APRON' },
  { label: 'Custom', value: 'CUSTOM' },
];

type FlashingDefaultUi = {
  key: string;
  label: string;
  defaultBand: CalculatorFlashingBand;
  lengthM: number;
};

type FlashingDefaultsDerivedInput = Partial<{
  rafter_length_m: number;
  timber_area_m2: number;
  ledger_length_m: number;
}>;

export function buildFlashingDefaultsForModule(
  module: CalculatorModuleInputs,
  derived?: FlashingDefaultsDerivedInput,
): FlashingDefaultUi[] {
  if (module.roofMaterial === 'none') return [];

  const roofType = getRoofTypeForModule(module);
  const projectionM = Number.isFinite(toNumber(module.projectionM)) ? Math.max(0, toNumber(module.projectionM)) : 0;
  const roofLengthM = roofLengthForPrimaryFlashing(module);

  const out: FlashingDefaultUi[] = [];
  const addDefault = (key: string, label: string, defaultBand: CalculatorFlashingBand, lengthRaw: number) => {
    const length = Number(lengthRaw);
    if (!Number.isFinite(length) || length <= 0) return;
    out.push({ key, label, defaultBand, lengthM: length });
  };

  if (roofType === 'pitched') {
    addDefault('pitched_primary', 'Primary flashing', '201-300', roofLengthM);
    if (module.invertedEnabled) {
      addDefault('pitched_secondary', 'Secondary flashing', '201-300', roofLengthM);
    }
  } else if (roofType === 'gable' || roofType === 'low_gable') {
    addDefault('gable_ridge', 'Ridge flashing', '301-400', roofLengthM);
  } else if (roofType === 'hip') {
    const ledgerLengthM =
      typeof derived?.ledger_length_m === 'number' && Number.isFinite(derived.ledger_length_m) && derived.ledger_length_m > 0
        ? derived.ledger_length_m
        : roofLengthM;
    addDefault('hip_ledger', 'Hip ledger flashing', '201-300', ledgerLengthM);
  } else {
    addDefault('roof_primary', 'Primary flashing', '201-300', roofLengthM);
  }

  const hasTimber =
    module.roofMaterial === 'timber' ||
    (module.roofMaterial === 'mixed' &&
      (typeof derived?.timber_area_m2 === 'number' ? Number(derived.timber_area_m2) > 1e-6 : true));

  if (!hasTimber) return out;

  let slopeLengthM = typeof derived?.rafter_length_m === 'number' && Number.isFinite(derived.rafter_length_m) ? derived.rafter_length_m : NaN;
  if (!Number.isFinite(slopeLengthM) || slopeLengthM <= 0) {
    const pitchDeg = getPitchForModule(module);
    const cos = Math.max(0.02, Math.cos((pitchDeg * Math.PI) / 180));
    const runM = roofType === 'gable' || roofType === 'low_gable' || roofType === 'hip' ? projectionM / 2 : projectionM;
    slopeLengthM = runM > 0 ? runM / cos : 0;
  }
  const edgeLengthM = Math.max(0, slopeLengthM + FLASHING_EDGE_ALLOWANCE_M);

  if (roofType === 'pitched') {
    addDefault('timber_edge_left', 'Timber edge rafter flashing (left)', '0-200', edgeLengthM);
    addDefault('timber_edge_right', 'Timber edge rafter flashing (right)', '0-200', edgeLengthM);
  } else if (roofType === 'gable' || roofType === 'low_gable') {
    addDefault('timber_edge_a_left', 'Timber edge rafter flashing (A left)', '0-200', edgeLengthM);
    addDefault('timber_edge_a_right', 'Timber edge rafter flashing (A right)', '0-200', edgeLengthM);
    addDefault('timber_edge_b_left', 'Timber edge rafter flashing (B left)', '0-200', edgeLengthM);
    addDefault('timber_edge_b_right', 'Timber edge rafter flashing (B right)', '0-200', edgeLengthM);
  }

  return out;
}

export function calculateFlashingTotalsByBand(rows: CalculatorFlashingsState['rows']): Record<CalculatorFlashingBand, number> {
  const totals: Record<CalculatorFlashingBand, number> = { '0-200': 0, '201-300': 0, '301-400': 0 };
  for (const row of rows) {
    const length = toNumber(row.lengthM);
    if (!Number.isFinite(length) || length <= 0) continue;
    totals[normalizeFlashingBand(row.band)] += length;
  }
  return totals;
}

export function calculateFlashingTotalLength(totals: Record<CalculatorFlashingBand, number>): number {
  return FLASHING_BANDS.reduce((sum, band) => sum + totals[band], 0);
}

export function selectVisibleFlashingBands(
  totals: Record<CalculatorFlashingBand, number>,
  showAllBands: boolean,
): CalculatorFlashingBand[] {
  return FLASHING_BANDS.filter((band) => showAllBands || totals[band] > 0);
}

export function isDuplicatePrimaryFlashingRow(
  row: CalculatorFlashingsState['rows'][number],
  primaryRow: CalculatorFlashingsState['rows'][number],
): boolean {
  if (row.kind === 'primary') return false;
  const parsedLength = toNumber(row.lengthM);
  const primaryLength = toNumber(primaryRow.lengthM);
  return (
    Number.isFinite(parsedLength) &&
    parsedLength > 0 &&
    Number.isFinite(primaryLength) &&
    primaryLength > 0 &&
    normalizeFlashingBand(row.band) === normalizeFlashingBand(primaryRow.band) &&
    Math.abs(parsedLength - primaryLength) <= FLASHING_DUPLICATE_TOLERANCE_M
  );
}
