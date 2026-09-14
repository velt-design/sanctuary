import 'server-only';
import type { ResolvedPublishedCostingConfigurationV1 } from '@sp/costing/server';
import { parsePreviewDraft } from '../components/configurator-prototype/previewDraft';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
import { getRoofFinish } from '../components/configurator-prototype/roofFinish';
import { calculateConfiguratorPricing } from './configuratorReviewPrice';
import type { ConfiguratorPriceLine } from './configuratorPublicPrice';

/** Server-only snapshot; includes private costing and must never be returned by the public API. */
export type FrozenConfiguratorPrice = {
  schemaVersion: 'configurator-pricing.v1'; design: PreviewDraft;
  costingConfiguration: ResolvedPublishedCostingConfigurationV1['provenance'];
  siteInputs: NonNullable<ReturnType<typeof calculateConfiguratorPricing>['siteInputs']>;
  base: NonNullable<ReturnType<typeof calculateConfiguratorPricing>['base']>;
  customerPrice: { amountIncGst: number; includesGst: true; currency: 'NZD'; breakdown: ConfiguratorPriceLine[] };
};

export function calculateFrozenConfiguratorPrice(draft: PreviewDraft, resolved: ResolvedPublishedCostingConfigurationV1): FrozenConfiguratorPrice | null {
  const design = parsePreviewDraft(draft);
  if (!design) return null;
  // Complete versioned schedules are required: never seed review constants in a public calculation.
  if (!resolved.config.accessoryRates || !resolved.config.installedSellingRates) return null;
  const finish = getRoofFinish(design.roof);
  if (finish.material !== 'acrylic' && finish.profile === 'trapezoidal') return null;
  const calculation = calculateConfiguratorPricing(design, resolved.config), result = calculation.estimate;
  if (result.status !== 'priced' || result.excluded.length || !calculation.base || !calculation.siteInputs || !result.breakdown?.length) return null;
  const breakdown = result.breakdown.map(line => ({ label: line.label, amountIncGst: line.amount }));
  if (breakdown.some(line => !Number.isSafeInteger(line.amountIncGst) || line.amountIncGst < 0)
    || !Number.isSafeInteger(result.amount) || result.amount <= 0 || breakdown.reduce((n, line) => n + line.amountIncGst, 0) !== result.amount) return null;
  return { schemaVersion: 'configurator-pricing.v1', design, costingConfiguration: resolved.provenance,
    siteInputs: calculation.siteInputs, base: calculation.base,
    customerPrice: { amountIncGst: result.amount, includesGst: true, currency: 'NZD', breakdown } };
}
