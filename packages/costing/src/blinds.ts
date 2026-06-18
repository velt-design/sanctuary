export const GST_RATE = 0.15;

export type BlindSystemType = 'ZIPTRAK' | 'OMNI';
export type BlindFabric = 'MESH' | 'PVC' | 'FINE_MESH' | 'NONE';

export type BlindLineItemInput = {
  id: string;
  label?: string;
  system: BlindSystemType;
  widthMm: number | null;
  coverLengthMm: number | null;
  fabric: BlindFabric;
  motorised: boolean | null;
};

export type BlindLineItemPricing = {
  id: string;
  label?: string;
  system: BlindSystemType;
  widthMm: number | null;
  coverLengthMm: number | null;
  effectiveWidthMm: number;
  effectiveCoverLengthMm: number;
  widthBandMm: number;
  lengthBandMm: number;
  baseExCents: number;
  fabricMultiplier: number;
  motorExCents: number;
  blindSellExCents: number;
  blindSellIncCents: number;
  warnings: string[];
  errors: string[];
};

export type BlindPricingTotals = {
  totalExCents: number;
  totalIncCents: number;
};

export type BlindPricingResult = {
  items: BlindLineItemPricing[];
  totals: BlindPricingTotals;
};

const DIMENSION_ROUNDING_INCREMENT_MM = 3;
const MOTOR_ADDON_INC_CENTS = 90000;
const MOTOR_ADDON_EX_CENTS = Math.round(MOTOR_ADDON_INC_CENTS / (1 + GST_RATE));

const FABRIC_MULTIPLIERS: Record<Exclude<BlindFabric, 'NONE'>, number> = {
  MESH: 1.0,
  PVC: 1.1,
  FINE_MESH: 1.15,
};

const ZIPTRAK_TABLE = {
  maxWidthMm: 6000,
  maxCoverLengthMm: 3500,
  cols: [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4200, 4800, 6000],
  rows: [1000, 1500, 2000, 2500, 3000, 3500],
  values: [
    [1029.57, 1253.04, 1409.57, 1611.3, 1732.17, 1936.52, 2072.17, 2657.39, 2896.52, 3545.22],
    [1109.57, 1338.26, 1494.78, 1694.78, 1814.78, 2021.74, 2157.39, 2742.61, 2981.74, 3628.7],
    [1294.78, 1518.26, 1674.78, 1875.65, 1997.39, 2202.61, 2337.39, 2922.61, 3161.74, 3810.43],
    [1349.57, 1573.04, 1730.43, 1930.43, 2050.43, 2257.39, 2392.17, 2978.26, 3216.52, 3863.48],
    [1460.0, 1686.96, 1845.22, 2045.22, 2165.22, 2370.43, 2507.83, 3091.3, 3331.3, 3979.13],
    [1966.96, 2232.17, 2432.17, 2666.09, 2829.57, 3069.57, 3240.0, 3832.17, 4092.17, 4863.48],
  ],
};

const OMNI_TABLE = {
  maxWidthMm: 4500,
  maxCoverLengthMm: 3000,
  cols: [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500],
  rows: [1000, 1500, 2000, 2500, 3000],
  values: [
    [830.43, 986.09, 1104.35, 1291.3, 1379.13, 1630.43, 1681.74, 1902.61],
    [849.57, 1005.22, 1123.48, 1310.43, 1397.39, 1649.57, 1700.87, 1921.74],
    [868.7, 1024.35, 1142.61, 1328.7, 1416.52, 1668.7, 1720.0, 1940.87],
    [886.96, 1043.48, 1161.74, 1347.83, 1435.65, 1687.83, 1738.26, 1960.0],
    [906.09, 1062.61, 1180.0, 1366.96, 1454.78, 1706.09, 1757.39, 1979.13],
  ],
};

function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function roundUpToIncrementMm(value: number, incrementMm = DIMENSION_ROUNDING_INCREMENT_MM): number {
  if (!Number.isFinite(value)) return 0;
  if (incrementMm <= 0) return Math.round(value);
  return Math.ceil(value / incrementMm) * incrementMm;
}

export function getBand(value: number, bands: number[]): number {
  if (!Number.isFinite(value) || bands.length === 0) return bands[0] ?? 0;
  for (const band of bands) {
    if (value <= band) return band;
  }
  return bands[bands.length - 1] ?? 0;
}

function lookupTable(systemType: BlindSystemType) {
  return systemType === 'OMNI' ? OMNI_TABLE : ZIPTRAK_TABLE;
}

export function getBlindSystemLimits(systemType: BlindSystemType): { maxWidthMm: number; maxCoverLengthMm: number } {
  const table = lookupTable(systemType);
  return { maxWidthMm: table.maxWidthMm, maxCoverLengthMm: table.maxCoverLengthMm };
}

export function lookupBaseExCents(systemType: BlindSystemType, coverLengthMm: number, widthMm: number): {
  widthBandMm: number;
  lengthBandMm: number;
  baseExCents: number;
} {
  const table = lookupTable(systemType);
  const widthBand = getBand(widthMm, table.cols);
  const lengthBand = getBand(coverLengthMm, table.rows);
  const rowIdx = table.rows.indexOf(lengthBand);
  const colIdx = table.cols.indexOf(widthBand);
  const row = table.values[rowIdx];
  const value = row?.[colIdx];
  const baseExCents = typeof value === 'number' ? roundCents(value * 100) : 0;
  return { widthBandMm: widthBand, lengthBandMm: lengthBand, baseExCents };
}

export function getFabricMultiplier(fabric: BlindFabric): number {
  if (fabric === 'PVC') return FABRIC_MULTIPLIERS.PVC;
  if (fabric === 'FINE_MESH') return FABRIC_MULTIPLIERS.FINE_MESH;
  return FABRIC_MULTIPLIERS.MESH;
}

export function getMotorExCents(motorised: boolean | null): number {
  return motorised ? MOTOR_ADDON_EX_CENTS : 0;
}

export function priceBlindLineItem(input: BlindLineItemInput): BlindLineItemPricing {
  const errors: string[] = [];
  const warnings: string[] = [];

  const widthMm = input.widthMm;
  const coverLengthMm = input.coverLengthMm;

  if (!Number.isFinite(widthMm ?? NaN) || (widthMm ?? 0) <= 0) {
    errors.push('Enter width and cover length');
  }
  if (!Number.isFinite(coverLengthMm ?? NaN) || (coverLengthMm ?? 0) <= 0) {
    if (!errors.length) errors.push('Enter width and cover length');
  }

  const effectiveWidthMm = roundUpToIncrementMm(Number(widthMm ?? 0));
  const effectiveCoverLengthMm = roundUpToIncrementMm(Number(coverLengthMm ?? 0));

  const { maxWidthMm, maxCoverLengthMm } = getBlindSystemLimits(input.system);
  if (effectiveWidthMm > maxWidthMm) {
    errors.push(`Exceeds max width; split into multiple blinds.`);
  }
  if (effectiveCoverLengthMm > maxCoverLengthMm) {
    errors.push(`Exceeds max cover length; manual quote required.`);
  }

  if (errors.length) {
    return {
      id: input.id,
      label: input.label,
      system: input.system,
      widthMm,
      coverLengthMm,
      effectiveWidthMm,
      effectiveCoverLengthMm,
      widthBandMm: 0,
      lengthBandMm: 0,
      baseExCents: 0,
      fabricMultiplier: getFabricMultiplier(input.fabric),
      motorExCents: getMotorExCents(input.motorised),
      blindSellExCents: 0,
      blindSellIncCents: 0,
      warnings,
      errors,
    };
  }

  const { widthBandMm, lengthBandMm, baseExCents } = lookupBaseExCents(input.system, effectiveCoverLengthMm, effectiveWidthMm);
  const fabricMultiplier = getFabricMultiplier(input.fabric);
  const afterFabricExCents = roundCents(baseExCents * fabricMultiplier);
  const motorExCents = getMotorExCents(input.motorised);
  const blindSellExCents = roundCents(afterFabricExCents + motorExCents);
  const blindSellIncCents = roundCents(blindSellExCents * (1 + GST_RATE));

  return {
    id: input.id,
    label: input.label,
    system: input.system,
    widthMm,
    coverLengthMm,
    effectiveWidthMm,
    effectiveCoverLengthMm,
    widthBandMm,
    lengthBandMm,
    baseExCents,
    fabricMultiplier,
    motorExCents,
    blindSellExCents,
    blindSellIncCents,
    warnings,
    errors,
  };
}

export function priceAllBlinds(inputs: BlindLineItemInput[]): BlindPricingResult {
  const items = inputs.map((input) => priceBlindLineItem(input));
  const totalExCents = roundCents(
    items.reduce((sum, item) => (item.errors.length ? sum : sum + item.blindSellExCents), 0),
  );
  const totalIncCents = roundCents(totalExCents * (1 + GST_RATE));
  return {
    items,
    totals: { totalExCents, totalIncCents },
  };
}

export function splitWidthsEvenly(totalWidthMm: number, panelCount: number, incrementMm = DIMENSION_ROUNDING_INCREMENT_MM): number[] | null {
  if (!Number.isFinite(totalWidthMm) || totalWidthMm <= 0) return null;
  if (!Number.isFinite(panelCount) || panelCount <= 0) return null;

  const roundedTotal = roundUpToIncrementMm(totalWidthMm, incrementMm);
  if (panelCount === 1) return [roundedTotal];

  const base = Math.floor(roundedTotal / panelCount);
  const widths = Array.from({ length: panelCount }, () => base);
  let remainder = roundedTotal - base * panelCount;
  let idx = 0;
  while (remainder > 0 && idx < widths.length) {
    widths[idx] += 1;
    remainder -= 1;
    idx = (idx + 1) % widths.length;
  }
  return widths;
}

export function autoSplitByMaxWidth(
  totalWidthMm: number,
  maxWidthMm: number,
  incrementMm = DIMENSION_ROUNDING_INCREMENT_MM,
): number[] | null {
  if (!Number.isFinite(totalWidthMm) || totalWidthMm <= 0) return null;
  if (!Number.isFinite(maxWidthMm) || maxWidthMm <= 0) return null;

  const roundedTotal = roundUpToIncrementMm(totalWidthMm, incrementMm);
  let panelCount = Math.ceil(roundedTotal / maxWidthMm);
  while (panelCount <= 12) {
    const widths = splitWidthsEvenly(roundedTotal, panelCount, incrementMm);
    if (!widths) return null;
    if (Math.max(...widths) <= maxWidthMm + 1e-6) return widths;
    panelCount += 1;
  }
  return null;
}
