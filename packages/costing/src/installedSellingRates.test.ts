import { describe, expect, it } from 'vitest';
import { getDefaultInstalledSellingRates, validateInstalledSellingRates } from './installedSellingRates';
import { priceBlindLineItem, priceAllBlinds, type BlindLineItemInput } from './blinds';
import { priceAllRafterLighting, priceRafterLighting } from './lighting';
import { applyCostingControlConfigV1, diffCostingControlConfigsV1, snapshotCostingControlConfigV1, validateCostingControlConfigV1 } from './controlConfig';
import { loadCostingConfigV1 } from './engine/config';

const blind: BlindLineItemInput = { id: 'test', system: 'ZIPTRAK', widthMm: 1998, coverLengthMm: 1998, fabric: 'MESH', motorised: false, rollCover: 'NONE' };
const lights = { pergolaId: 'test', lightCount: 17, dimmer: false, acrylicEligible: true };

describe('versioned installed selling schedules', () => {
  it('preserves existing outputs across both blind systems, fabrics, covers and lighting driver boundaries', () => {
    const rates = getDefaultInstalledSellingRates();
    for (const system of ['ZIPTRAK', 'OMNI'] as const) for (const fabric of ['MESH', 'PVC', 'FINE_MESH', 'NONE'] as const)
      for (const rollCover of ['NONE', 'FLASHING', 'PELMET'] as const) for (const motorised of [true, false]) {
        const input = { ...blind, system, fabric, rollCover, motorised };
        expect(priceBlindLineItem(input, rates.blinds)).toEqual(priceBlindLineItem(input));
      }
    for (const lightCount of [0, 1, 12, 13, 16, 17, 32, 33]) for (const dimmer of [true, false]) {
      expect(priceRafterLighting({ ...lights, lightCount, dimmer }, rates.rafterLighting)).toEqual(priceRafterLighting({ ...lights, lightCount, dimmer }));
    }
    expect(priceAllBlinds([blind], rates.blinds)).toEqual(priceAllBlinds([blind]));
    expect(priceAllRafterLighting([lights], rates.rafterLighting)).toEqual(priceAllRafterLighting([lights]));
  });

  it('roundtrips a draft and uses its exact installed rates without a second selling multiplier', () => {
    const base = loadCostingConfigV1(), historical = snapshotCostingControlConfigV1(base), draft = structuredClone(historical);
    expect(snapshotCostingControlConfigV1(applyCostingControlConfigV1(base, historical))).toEqual(historical);
    expect(historical).not.toHaveProperty('installedSellingRates');
    draft.installedSellingRates = getDefaultInstalledSellingRates();
    draft.installedSellingRates.blinds.ziptrakBaseExGst[2][2] = 1000;
    draft.installedSellingRates.blinds.coreSellMultiplier = 1;
    draft.installedSellingRates.rafterLighting.lightIncCents = 10000;
    const applied = applyCostingControlConfigV1(base, draft), rates = applied.installedSellingRates!;
    expect(snapshotCostingControlConfigV1(applied)).toEqual(draft);
    expect(priceBlindLineItem(blind, rates.blinds).blindSellIncCents).toBe(115000);
    expect(priceRafterLighting(lights, rates.rafterLighting).lightingSellIncCents).toBe(80000 + 17 * 10000 + 50000);
    expect(diffCostingControlConfigsV1(historical, draft)).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'installedSellingRates.blinds.ziptrakBaseExGst.2.2', after: 1000 })]));
    rates.blinds.ziptrakBaseExGst[2][2] = 123;
    expect(draft.installedSellingRates.blinds.ziptrakBaseExGst[2][2]).toBe(1000);
    expect(getDefaultInstalledSellingRates().blinds.ziptrakBaseExGst[2][2]).not.toBe(1000);
  });

  it('rejects incomplete schedules, unsupported bands, fractional cents and invalid capacities', () => {
    const base = loadCostingConfigV1(), draft = snapshotCostingControlConfigV1(base);
    const cases: unknown[] = [null, {}, { ...getDefaultInstalledSellingRates(), extra: 1 }];
    const badBand = getDefaultInstalledSellingRates(); badBand.blinds.ziptrakBaseExGst[0].pop(); cases.push(badBand);
    const fractional = getDefaultInstalledSellingRates(); fractional.rafterLighting.lightIncCents = 1.5; cases.push(fractional);
    const zeroCapacity = getDefaultInstalledSellingRates(); zeroCapacity.rafterLighting.standardDriverCapacity = 0; cases.push(zeroCapacity);
    const paidUncovered = getDefaultInstalledSellingRates(); paidUncovered.blinds.coverIncCentsPerM.NONE = 100; cases.push(paidUncovered);
    for (const rates of cases) {
      expect(validateInstalledSellingRates(rates).length).toBeGreaterThan(0);
      expect(validateCostingControlConfigV1({ ...draft, installedSellingRates: rates }, base).ok).toBe(false);
    }
    expect(validateInstalledSellingRates(getDefaultInstalledSellingRates())).toEqual([]);
  });
});
