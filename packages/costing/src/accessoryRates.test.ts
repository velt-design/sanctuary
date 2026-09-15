import { expect, it } from 'vitest';
import { ACCESSORY_REVIEW_RATES, validateAccessoryRates, type AccessoryRates } from './accessoryRates';
import { reviewAccessoryAssemblyCost, reviewSlatCost } from './accessoryReview';
import { loadCostingConfigV1 } from './engine/config';
import { applyCostingControlConfigV1, snapshotCostingControlConfigV1, validateCostingControlConfigV1, diffCostingControlConfigsV1 } from './controlConfig';

it('preserves historical versions without manufacturing new accessory allowances', () => {
  const base = loadCostingConfigV1(), before = snapshotCostingControlConfigV1(base);
  expect(before).not.toHaveProperty('accessoryRates');
  expect(snapshotCostingControlConfigV1(applyCostingControlConfigV1(base,before))).toEqual(before);
});
it('round trips explicit versioned rates and uses them in accessory calculations', () => {
  const base = loadCostingConfigV1(), before = snapshotCostingControlConfigV1(base);
  const rates: AccessoryRates = structuredClone(ACCESSORY_REVIEW_RATES);
  rates.cedarLightSupplyAndFitEach = 200;
  rates.timberSupplyPerM['65x39'] = 36.08;
  rates.selectedTimberLengthFactor = 1;
  rates.timberCoatingPerM = 0;
  const candidate = {...before,accessoryRates:rates};
  const applied = applyCostingControlConfigV1(base,candidate);
  expect(snapshotCostingControlConfigV1(applied)).toEqual(candidate);
  expect(diffCostingControlConfigsV1(before,candidate)).toContainEqual({path:'accessoryRates.cedarLightSupplyAndFitEach',before:null,after:200});
  expect(reviewAccessoryAssemblyCost({cedarLights:4},applied.accessoryRates)).toBe(800);
  expect(reviewAccessoryAssemblyCost({cedarLights:4})).toBe(560);
  expect(reviewSlatCost({material:'timber',profile:'65x39',lengthM:10,cutPieces:0,fixingPoints:0,setup:false,frameM:0},rates)).toBeCloseTo(396.88);
  expect(ACCESSORY_REVIEW_RATES.timberSupplyPerM['65x39']).toBe(18);
});
it('rejects incomplete, unknown, nonnumeric and out-of-range catalogues at the version boundary', () => {
  const base = loadCostingConfigV1(), control = snapshotCostingControlConfigV1(base);
  for(const value of [null, {}, {...ACCESSORY_REVIEW_RATES, extraRate:1}, {...ACCESSORY_REVIEW_RATES,wasteFactor:.1}, {...ACCESSORY_REVIEW_RATES,ledDriverPerRun:NaN}, {...ACCESSORY_REVIEW_RATES,cedarLightSupplyAndFitEach:'200'}]) {
    expect(validateAccessoryRates(value).length).toBeGreaterThan(0);
    expect(validateCostingControlConfigV1({...control,accessoryRates:value},base).ok).toBe(false);
  }
});
