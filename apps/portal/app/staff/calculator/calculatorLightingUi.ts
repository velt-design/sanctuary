import { priceRafterLighting, type RafterLightingLinePricing } from '@sp/costing';

import type {
  CalculatorInputs,
  CalculatorLightingInput,
} from '@/lib/types/calculator';
import {
  calculatorPergolaById,
  calculatorPergolaSupportsRafterLighting,
} from '@/lib/estimates/calculatorLighting';
import {
  makeDefaultCalculatorLightingInput,
  normalizeCalculatorLightingInput,
  normalizePergolasForUi,
} from './calculatorInputs';

export type CalculatorLightingUi = {
  visible: boolean;
  eligible: boolean;
  pergolaLabel: string;
  input: CalculatorLightingInput;
  pricing: RafterLightingLinePricing;
  summaryText: string;
};

function hasConfiguredLighting(input: CalculatorLightingInput | undefined): boolean {
  if (!input) return false;
  const count = Number(input.lightCount);
  return input.dimmer || !Number.isFinite(count) || count !== 0;
}

export function buildCalculatorLightingUi(
  values: CalculatorInputs,
  activePergolaId: string,
): CalculatorLightingUi {
  const pergola = calculatorPergolaById(values, activePergolaId);
  const input = normalizeCalculatorLightingInput(pergola?.lighting ?? makeDefaultCalculatorLightingInput());
  const eligible = calculatorPergolaSupportsRafterLighting(values, activePergolaId);
  const parsedLightCount = input.lightCount.trim() ? Number(input.lightCount) : null;
  const pricing = priceRafterLighting({
    pergolaId: activePergolaId,
    label: pergola?.label,
    lightCount: typeof parsedLightCount === 'number' && Number.isFinite(parsedLightCount) ? parsedLightCount : null,
    dimmer: input.dimmer,
    acrylicEligible: eligible,
  });
  const lightLabel = `${pricing.lightCount} light${pricing.lightCount === 1 ? '' : 's'}`;
  const driverLabel = `${pricing.driverCount} driver${pricing.driverCount === 1 ? '' : 's'}`;

  return {
    visible: eligible || hasConfiguredLighting(pergola?.lighting),
    eligible,
    pergolaLabel: pergola?.label ?? 'Pergola',
    input,
    pricing,
    summaryText: pricing.lightCount > 0
      ? `${lightLabel} · ${driverLabel}${pricing.dimmer ? ' · Dimmer' : ''}`
      : 'No rafter lights',
  };
}

export function updateCalculatorPergolaLighting(
  values: CalculatorInputs,
  pergolaId: string,
  patch: Partial<CalculatorLightingInput>,
): CalculatorInputs {
  const pergolas = normalizePergolasForUi(values.pergolas).map((pergola) => {
    if (pergola.id !== pergolaId) return pergola;
    return {
      ...pergola,
      lighting: {
        ...normalizeCalculatorLightingInput(pergola.lighting ?? makeDefaultCalculatorLightingInput()),
        ...patch,
      },
    };
  });
  return { ...values, pergolas };
}
