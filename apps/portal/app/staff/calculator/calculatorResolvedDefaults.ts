import type { CostOutputV1 } from '@sp/costing';

import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { toNumber } from './calculatorInputs';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';

export type CalculatorResolvedDefaultTexts = Readonly<
  Partial<Record<'roofPitchDeg' | 'downpipeCount', string>>
>;

type CalculatorResolvedDefaultsInput = {
  activeModule: Pick<
    CalculatorModuleInputs,
    'roofPitchDeg' | 'downpipeCount' | 'boxPerimeterEnabled'
  >;
  moduleResult: Pick<CostOutputV1, 'derived' | 'inputs_normalized'> | null;
  hasOurGutter: boolean;
  resultFreshness: CalculatorResultFreshness;
};

function formatResolvedNumber(value: number): string {
  return new Intl.NumberFormat('en-NZ', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatResolvedDefaultText(
  value: number | undefined,
  unit: (resolved: number) => string,
  freshness: CalculatorResultFreshness,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || freshness === 'waiting') {
    return 'Auto - confirmed after a valid calculation';
  }

  const resolvedValue = `${formatResolvedNumber(value)} ${unit(value)}`;
  if (freshness === 'current') {
    return `Auto - current result uses ${resolvedValue}`;
  }
  if (freshness === 'calculating' || freshness === 'stale') {
    return `Auto - last valid result used ${resolvedValue}; updating`;
  }
  return `Auto - last valid result used ${resolvedValue}; fix inputs to confirm`;
}

export function buildCalculatorResolvedDefaults({
  activeModule,
  moduleResult,
  hasOurGutter,
  resultFreshness,
}: CalculatorResolvedDefaultsInput): CalculatorResolvedDefaultTexts {
  const resolvedDefaults: Partial<Record<'roofPitchDeg' | 'downpipeCount', string>> = {};
  const pitchIsAutomatic =
    activeModule.boxPerimeterEnabled || activeModule.roofPitchDeg.trim() === '';
  const rawDownpipeCount = activeModule.downpipeCount.trim();
  const parsedDownpipeCount = toNumber(activeModule.downpipeCount);
  const downpipeIsAutomatic =
    hasOurGutter &&
    (rawDownpipeCount === '' ||
      (Number.isFinite(parsedDownpipeCount) && parsedDownpipeCount === 0));

  if (pitchIsAutomatic) {
    resolvedDefaults.roofPitchDeg = formatResolvedDefaultText(
      moduleResult?.derived.roof_pitch_deg_used,
      () => 'deg',
      resultFreshness,
    );
  }

  if (downpipeIsAutomatic) {
    resolvedDefaults.downpipeCount = formatResolvedDefaultText(
      moduleResult?.inputs_normalized.downpipe_count,
      (value) => (value === 1 ? 'downpipe' : 'downpipes'),
      resultFreshness,
    );
  }

  return resolvedDefaults;
}
