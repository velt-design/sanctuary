import { describe, expect, it } from 'vitest';
import { INITIAL_PRODUCT_SELECTION } from '../components/products/productSelectionValues';
import { LANDING_PRICE_CELLS, LANDING_PRICE_SCHEMA, landingPriceIndex, lookupLandingPrice, parseLandingPriceTable, type LandingPriceTable } from './landingPriceTable';

const table: LandingPriceTable = { schema: LANDING_PRICE_SCHEMA, id: 'a'.repeat(64), publicationKey: 'b'.repeat(64), versionId: '11111111-1111-4111-8111-111111111111',
  versionNumber: 1, currency: 'NZD' as const, includesGst: true as const, amounts: Array(LANDING_PRICE_CELLS).fill(12345) as number[] };
describe('closed landing table contract', () => {
  it('addresses first and last exact grid cells and returns explicit unsupported/custom statuses', () => {
    expect(landingPriceIndex('pitched', { ...INITIAL_PRODUCT_SELECTION, widthMm: 1500, projectionMm: 1500 })).toBe(0);
    expect(landingPriceIndex('box-perimeter', { ...INITIAL_PRODUCT_SELECTION, widthMm: 10000, projectionMm: 6000, material: 'combination' })).toBe(LANDING_PRICE_CELLS - 1);
    const index = landingPriceIndex('gable', INITIAL_PRODUCT_SELECTION)!;
    expect(lookupLandingPrice(table, 'gable', INITIAL_PRODUCT_SELECTION)).toEqual({ status: 'priced', amountIncGst: 12345 });
    const variant = { ...table, amounts: [...table.amounts] };
    variant.amounts[index] = -1; expect(lookupLandingPrice(variant, 'gable', INITIAL_PRODUCT_SELECTION)).toEqual({ status: 'issue' });
    variant.amounts[index] = 0; expect(lookupLandingPrice(variant, 'gable', INITIAL_PRODUCT_SELECTION)).toEqual({ status: 'custom' });
  });
  it.each([{ widthMm: 1450 }, { widthMm: 1550 }, { widthMm: 10100 }, { projectionMm: 6100 }, { widthMm: NaN }, { sides: 'all' as const }, { orientation: 'away' as const }])('never silently clamps or prices outside the standard table: %o', patch => {
    expect(lookupLandingPrice(table, 'pitched', { ...INITIAL_PRODUCT_SELECTION, ...patch })).toBeNull();
  });
  it('rejects incomplete, malformed and wrong-schema payloads and projects only the public contract', () => {
    for (const patch of [{ schema: 'v2' }, { amounts: [10] }, { id: 'bad' }, { includesGst: false }, { versionNumber: 0 }, { amounts: table.amounts.map((n, i) => i ? n : -2) }]) {
      expect(parseLandingPriceTable({ ...table, ...patch })).toBeNull();
    }
    expect(parseLandingPriceTable({ ...table, privateUnexpected: 'discarded' })).toEqual(table);
  });
});
