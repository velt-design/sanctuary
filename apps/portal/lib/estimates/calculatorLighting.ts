import {
  priceAllRafterLighting,
  type RafterLightingInput,
  type RafterLightingPricingResult,
} from '@sp/costing';

import type { CalculatorInputs, CalculatorPergola } from '@/lib/types/calculator';

function parseLightCount(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasStructuredCalculatorLighting(inputs: CalculatorInputs | null | undefined): boolean {
  return (inputs?.pergolas ?? []).some((pergola) => Object.prototype.hasOwnProperty.call(pergola, 'lighting'));
}

export function calculatorPergolaSupportsRafterLighting(inputs: CalculatorInputs, pergolaId: string): boolean {
  const fallbackPergolaId = inputs.pergolas?.[0]?.id;
  return inputs.modules.some(
    (module) => (module.pergolaId || fallbackPergolaId) === pergolaId && module.roofMaterial === 'acrylic',
  );
}

export function buildCalculatorLightingPricingInputs(inputs: CalculatorInputs): RafterLightingInput[] {
  return (inputs.pergolas ?? []).flatMap((pergola): RafterLightingInput[] => {
    if (!Object.prototype.hasOwnProperty.call(pergola, 'lighting')) return [];
    return [{
      pergolaId: pergola.id,
      label: pergola.label,
      lightCount: parseLightCount(pergola.lighting?.lightCount),
      dimmer: pergola.lighting?.dimmer === true,
      acrylicEligible: calculatorPergolaSupportsRafterLighting(inputs, pergola.id),
    }];
  });
}

export function priceCalculatorLighting(inputs: CalculatorInputs): RafterLightingPricingResult {
  return priceAllRafterLighting(buildCalculatorLightingPricingInputs(inputs));
}

export function calculatorPergolaById(
  inputs: CalculatorInputs,
  pergolaId: string,
): CalculatorPergola | null {
  return (inputs.pergolas ?? []).find((pergola) => pergola.id === pergolaId) ?? null;
}
