import {
  buildCommercialOverheadV5,
  isCommercialPolicyV5Enabled,
  type SitePricingPolicyV2,
} from '../commercial/simpleRangePricing';
import type { CostingConfigV1 } from './config';
import { allocateMoneyCentsByWeightV1 } from './moneyAllocation';
import type { OverheadV1, PergolaOutputV1, SiteInputsV1 } from './types';

type WeightedPergola = Pick<PergolaOutputV1, 'id' | 'materials' | 'install'>;

export function allocateCommercialSiteOverheadV5(params: {
  config: CostingConfigV1;
  inputs: SiteInputsV1;
  pricingPolicy: SitePricingPolicyV2 | undefined;
  productiveCrewHours: number;
  pergolas: WeightedPergola[];
}): Record<string, OverheadV1> | null {
  if (!params.pricingPolicy || !isCommercialPolicyV5Enabled(params.config)) return null;

  const siteOverhead = buildCommercialOverheadV5(
    params.config,
    params.inputs,
    params.productiveCrewHours,
    params.pricingPolicy.resolved_classification,
  );
  const weights = params.pergolas.map((pergola) => ({
    id: pergola.id,
    weight: Number(pergola.materials.totals.materials_ex_gst ?? 0)
      + Number(pergola.install.totals.install_ex_gst ?? 0),
  }));
  const opsShares = allocateMoneyCentsByWeightV1(Math.round(siteOverhead.ops_ex_gst * 100), weights);
  const salesShares = allocateMoneyCentsByWeightV1(Math.round(siteOverhead.sales_ex_gst * 100), weights);

  return Object.fromEntries(params.pergolas.map((pergola) => {
    const ops = (opsShares[pergola.id] ?? 0) / 100;
    const sales = (salesShares[pergola.id] ?? 0) / 100;
    return [pergola.id, {
      method: siteOverhead.method,
      ops_ex_gst: ops,
      sales_ex_gst: sales,
      total_ex_gst: ops + sales,
    }];
  }));
}
