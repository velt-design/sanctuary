import { GST_RATE } from './blinds';

export const RAFTER_LIGHTING_STARTUP_INC_CENTS = 80_000;
export const RAFTER_LIGHTING_LIGHT_INC_CENTS = 19_000;
export const RAFTER_LIGHTING_DIMMER_INC_CENTS = 50_000;
export const RAFTER_LIGHTING_EXTRA_DRIVER_INC_CENTS = 50_000;
export const RAFTER_LIGHTING_STANDARD_DRIVER_CAPACITY = 16;
export const RAFTER_LIGHTING_DIMMED_DRIVER_CAPACITY = 12;

export type RafterLightingInput = {
  pergolaId: string;
  label?: string;
  lightCount: number | null;
  dimmer: boolean;
  acrylicEligible: boolean;
};

export type RafterLightingLinePricing = {
  pergolaId: string;
  label?: string;
  lightCount: number;
  dimmer: boolean;
  driverCapacity: number;
  driverCount: number;
  additionalDriverCount: number;
  startupIncCents: number;
  lightsIncCents: number;
  dimmerIncCents: number;
  additionalDriversIncCents: number;
  lightingSellExCents: number;
  lightingSellIncCents: number;
  errors: string[];
};

export type RafterLightingPricingResult = {
  items: RafterLightingLinePricing[];
  totals: {
    totalExCents: number;
    totalIncCents: number;
  };
};

function zeroPricing(input: RafterLightingInput, lightCount = 0, errors: string[] = []): RafterLightingLinePricing {
  return {
    pergolaId: input.pergolaId,
    label: input.label,
    lightCount,
    dimmer: input.dimmer,
    driverCapacity: input.dimmer
      ? RAFTER_LIGHTING_DIMMED_DRIVER_CAPACITY
      : RAFTER_LIGHTING_STANDARD_DRIVER_CAPACITY,
    driverCount: 0,
    additionalDriverCount: 0,
    startupIncCents: 0,
    lightsIncCents: 0,
    dimmerIncCents: 0,
    additionalDriversIncCents: 0,
    lightingSellExCents: 0,
    lightingSellIncCents: 0,
    errors,
  };
}

export function priceRafterLighting(input: RafterLightingInput): RafterLightingLinePricing {
  const rawLightCount = input.lightCount;
  if (!Number.isFinite(rawLightCount ?? Number.NaN) || !Number.isInteger(rawLightCount) || Number(rawLightCount) < 0) {
    return zeroPricing(input, 0, ['Enter a whole light quantity of 0 or more.']);
  }

  const lightCount = Number(rawLightCount);
  if (lightCount === 0) return zeroPricing(input);
  if (!input.acrylicEligible) {
    return zeroPricing(input, lightCount, ['Rafter lighting is currently available only for acrylic pergolas.']);
  }

  const driverCapacity = input.dimmer
    ? RAFTER_LIGHTING_DIMMED_DRIVER_CAPACITY
    : RAFTER_LIGHTING_STANDARD_DRIVER_CAPACITY;
  const driverCount = Math.ceil(lightCount / driverCapacity);
  const additionalDriverCount = Math.max(0, driverCount - 1);
  const startupIncCents = RAFTER_LIGHTING_STARTUP_INC_CENTS;
  const lightsIncCents = lightCount * RAFTER_LIGHTING_LIGHT_INC_CENTS;
  const dimmerIncCents = input.dimmer ? RAFTER_LIGHTING_DIMMER_INC_CENTS : 0;
  const additionalDriversIncCents = additionalDriverCount * RAFTER_LIGHTING_EXTRA_DRIVER_INC_CENTS;
  const lightingSellIncCents = startupIncCents + lightsIncCents + dimmerIncCents + additionalDriversIncCents;

  return {
    pergolaId: input.pergolaId,
    label: input.label,
    lightCount,
    dimmer: input.dimmer,
    driverCapacity,
    driverCount,
    additionalDriverCount,
    startupIncCents,
    lightsIncCents,
    dimmerIncCents,
    additionalDriversIncCents,
    lightingSellExCents: Math.round(lightingSellIncCents / (1 + GST_RATE)),
    lightingSellIncCents,
    errors: [],
  };
}

export function priceAllRafterLighting(inputs: RafterLightingInput[]): RafterLightingPricingResult {
  const items = inputs.map(priceRafterLighting);
  const totalIncCents = items.reduce(
    (total, item) => total + (item.errors.length ? 0 : item.lightingSellIncCents),
    0,
  );
  return {
    items,
    totals: {
      totalExCents: Math.round(totalIncCents / (1 + GST_RATE)),
      totalIncCents,
    },
  };
}
