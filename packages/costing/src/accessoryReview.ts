import { calculateSiteCostV1 } from './engine/calculate';
import type { CostingConfigV1 } from './engine/config';
import type { InfillInputV1, SiteInputsV1 } from './engine/types';
import { calculateCustomerPriceFromCostEx } from './commercial/customerPricing';

import { ACCESSORY_REVIEW_RATES, type AccessoryRates } from './accessoryRates';
export { ACCESSORY_REVIEW_RATES } from './accessoryRates';

export type AccessoryReviewLine = { label: string; amount: number; provisional: boolean; detail: string };

export function accessoryReviewPricer(site: SiteInputsV1, config: CostingConfigV1) {
  const base = calculateSiteCostV1(site, config);
  const sell = (cost: number) => {
    if (!Number.isFinite(cost) || cost < 0) throw new Error('Invalid accessory review cost');
    const price = calculateCustomerPriceFromCostEx(cost, 0, base.pricing_policy?.customer_price_uplift_pct, base.pricing_policy?.customer_price_multiplier);
    if (!price) throw new Error('Missing accessory price');
    return Math.round(price.incGst);
  };
  return {
    allowance(label: string, cost: number, detail: string): AccessoryReviewLine {
      return { label, amount: sell(cost), provisional: true, detail };
    },
    infills(infills: InfillInputV1[]): AccessoryReviewLine | null {
      if (!infills.length) return null;
      const next = structuredClone(site);
      next.pergolas[0].modules[0].infills = infills;
      const result = calculateSiteCostV1(next, config);
      // Incremental materials, installation and operations; no second design fee.
      // Keep the base pergola's installer protection intact, rather than absorbing extras into it.
      const cost = result.totals.cost_ex_gst - base.totals.cost_ex_gst
        - (result.overhead.sales_ex_gst - base.overhead.sales_ex_gst);
      if (cost <= 0 || result.infill_takeoff?.status === 'blocked') throw new Error('Infill costing unavailable');
      return { label: 'Acrylic panels & infills', amount: sell(cost), provisional: true,
        detail: 'Portal infill takeoff, sheet allowance, joiners, supports and installation. Opening dimensions are representative; confirm framing and sheet specification.' };
    },
  };
}

export function reviewAccessoryAssemblyCost(q: { frameM?: number; upgradedFrameM?: number; cedarLights?: number; ledM?: number; ledRuns?: number }, rates: AccessoryRates = ACCESSORY_REVIEW_RATES) {
  if (!Object.values(q).every(n=>Number.isFinite(n)&&n>=0)) throw new Error('Invalid accessory quantities');
  const r=rates;
  return (q.frameM??0)*r.frameSupplyAndFitPerM + (q.upgradedFrameM??0)*r.upgradedFrameExtraPerM
    + (q.cedarLights??0)*r.cedarLightSupplyAndFitEach + (q.ledM??0)*r.ledSupplyChannelAndFitPerM + (q.ledRuns??0)*r.ledDriverPerRun;
}

export function reviewSlatCost(input: {
  material: 'timber' | 'aluminium'; species?: 'cedar' | 'thermopine'; profile: string; lengthM: number;
  cutPieces?: number; fixingPoints?: number;
  frameM: number; plateM?: number; setup?: boolean;
}, accessoryRates: AccessoryRates = ACCESSORY_REVIEW_RATES) {
  const r = accessoryRates;
  const rates: Record<string, number> = input.material === 'timber' ? (input.species === 'thermopine' ? r.thermopineSupplyPerM : r.timberSupplyPerM) : r.aluminiumSupplyPerM;
  const supply = rates[input.profile];
  if (!supply || ![input.lengthM, input.frameM, input.plateM ?? 0].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Unsupported slat costing');
  if (input.species !== undefined && !['cedar', 'thermopine'].includes(input.species)) throw new Error('Unsupported timber species');
  const timber = input.material === 'timber';
  if (timber && ![input.cutPieces, input.fixingPoints].every(n => Number.isInteger(n) && Number(n) >= 0)) throw new Error('Timber fitting quantities required');
  const fitting = timber ? ((input.cutPieces! * r.timberCutMinutes + input.fixingPoints! * r.timberFixMinutes) / 60
    + (input.setup === false ? 0 : r.timberSetupHours)) * r.timberLabourPerHour + input.fixingPoints! * r.timberFixingsPerPoint : 0;
  const perM = input.material === 'timber'
    ? supply * r.selectedTimberLengthFactor * r.wasteFactor + r.timberCoatingPerM
    : supply * r.wasteFactor + r.aluminiumFitPerM;
  return input.lengthM * perM + input.frameM * r.frameSupplyAndFitPerM
    + (input.plateM ?? 0) * r.plateSupplyAndFitPerM + fitting + (timber || input.setup === false ? 0 : r.panelSetup);
}
