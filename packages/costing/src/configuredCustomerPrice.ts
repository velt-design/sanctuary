import { calculateSiteCostV1 } from './engine/calculate';
import type { CostingConfigV1 } from './engine/config';
import type { SiteInputsV1 } from './engine/types';
import { calculateCustomerPriceFromCostEx } from './commercial/customerPricing';
import { calculateLegacyInstallerBenchmarkV1 } from './installerPayout';

/** Opt-in configured aluminium offer; does not reclassify saved quotes or agreements. */
export function calculateConfiguredCustomerPriceV1(request: {
  site: SiteInputsV1; config: CostingConfigV1; footprintM2: number;
  level: 'ground' | 'elevated'; roofStyle: 'pitched' | 'gable' | 'box_perimeter';
}) {
  const { site, config, footprintM2, level, roofStyle } = request;
  if (!['ground', 'elevated'].includes(level) || !Number.isFinite(footprintM2) || footprintM2 <= 0) throw new Error('Invalid configured footprint or level.');
  if (footprintM2 > (level === 'ground' ? 30 : 20)) throw new Error('Configured pricing area limit exceeded.');
  if (site.pergolas.length !== 1 || site.pergolas[0].modules.length !== 1) throw new Error('Configured pricing requires one pergola module.');
  // Keep the labour classification and all productive-time/operational allowances.
  const output = calculateSiteCostV1(site, config);
  if (output.overhead.method !== 'unified_commercial_v5') throw new Error('Configured offer requires the current commercial overhead policy.');
  const benchmarkExGst = calculateLegacyInstallerBenchmarkV1(footprintM2, roofStyle);
  const installationExGst = output.install.totals.install_ex_gst;
  const installerTopUpExGst = Math.max(0, Math.round((benchmarkExGst - installationExGst) * 100) / 100);
  const designAllowanceRemovedExGst = output.overhead.sales_ex_gst;
  const costExGst = Math.round((output.totals.cost_ex_gst - designAllowanceRemovedExGst + installerTopUpExGst) * 100) / 100;
  const price = calculateCustomerPriceFromCostEx(costExGst, 0, output.pricing_policy?.customer_price_uplift_pct, output.pricing_policy?.customer_price_multiplier);
  if (!price || price.incGst <= 0) throw new Error('Invalid configured price.');
  return { policyVersion: 'configured-offer.v1' as const, price, costExGst, siteOutput: output,
    designAllowanceRemovedExGst, installerTopUpExGst,
    protectedInstallationExGst: Math.round((installationExGst + installerTopUpExGst) * 100) / 100,
    operationalOverheadExGst: output.overhead.ops_ex_gst,
    costingWarnings: output.totals.warnings };
}
