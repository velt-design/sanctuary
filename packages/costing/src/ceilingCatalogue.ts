/** Supplier rates approved for the draft ceiling range on 11 September 2026.
 * Keep historical cedar identities unchanged. Publication is a separate step.
 */
export const CEILING_CATALOGUE = {
  'thermopine-100': { species: 'ThermoPine', coverMm: 100, thicknessMm: 12 },
  'thermopine-150': { species: 'ThermoPine', coverMm: 150, thicknessMm: 12 },
  'cedar-100': { species: 'Cedar', coverMm: 100, thicknessMm: 12 },
  'cedar-150': { species: 'Cedar', coverMm: 150, thicknessMm: 12 },
} as const;
export type CeilingOption = keyof typeof CEILING_CATALOGUE;
export type CeilingSelection = { option: CeilingOption };
export function isCeilingOption(value: unknown): value is CeilingOption {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CEILING_CATALOGUE, value);
}
/** No interpolation or fallback outside the supplier's quoted length bands. */
export function ceilingLengthSurcharge(lengthM: number): number {
  if (Number.isFinite(lengthM) && lengthM >= 1.8 && lengthM <= 2.4) return 0.1;
  if (Number.isFinite(lengthM) && lengthM >= 2.7 && lengthM <= 4.8) return 0.3;
  throw new Error('Selected ceiling length requires a supplier price outside the quoted 1.8–2.4 m and 2.7–4.8 m bands.');
}
