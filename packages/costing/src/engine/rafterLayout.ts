export const RAFTER_SPACING_MM_MAX = 642;
export const RAFTER_THICKNESS_MM = 50;

export type AcrylicRafterLayoutV1 = {
  rafterCount: number;
  bayCount: number;
  clearLengthMm: number;
  spacingMm: number;
  positions: number[];
};

/** Canonical acrylic-rafter layout used by costing and customer-safe plan views. */
export function calculateAcrylicRafterLayoutV1(lengthMm: number): AcrylicRafterLayoutV1 {
  const safeLengthMm = Number.isFinite(lengthMm) ? Math.max(0, lengthMm) : 0;
  const clearLengthMm = Math.max(0, safeLengthMm - RAFTER_THICKNESS_MM);
  const bayCount = Math.max(1, Math.ceil(clearLengthMm / RAFTER_SPACING_MM_MAX));
  const rafterCount = bayCount + 1;
  const spacingMm = clearLengthMm / bayCount;
  const edgeCentreInsetMm = Math.min(safeLengthMm / 2, RAFTER_THICKNESS_MM / 2);

  return {
    rafterCount,
    bayCount,
    clearLengthMm,
    spacingMm,
    positions: safeLengthMm > 0
      ? Array.from(
          { length: rafterCount },
          (_, index) => (edgeCentreInsetMm + index * spacingMm) / safeLengthMm,
        )
      : Array.from({ length: rafterCount }, () => 0.5),
  };
}
