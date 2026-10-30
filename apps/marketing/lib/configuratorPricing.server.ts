import 'server-only';
import type { ResolvedPublishedCostingConfigurationV1 } from '@sp/costing/server';
import { parsePreviewDraft } from '../components/configurator-prototype/previewDraft';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
import { calculateConfiguratorPricing } from './configuratorReviewPrice';
import type { ConfiguratorPriceLine } from './configuratorPublicPrice';

type ConfiguratorBase = NonNullable<ReturnType<typeof calculateConfiguratorPricing>['base']>;

/** Server-only snapshot; includes private costing and must never be returned by the public API. */
export type FrozenConfiguratorPrice = {
  schemaVersion: 'configurator-pricing.v1'; design: PreviewDraft;
  costingConfiguration: ResolvedPublishedCostingConfigurationV1['provenance'];
  siteInputs: NonNullable<ReturnType<typeof calculateConfiguratorPricing>['siteInputs']>;
  base: Omit<ConfiguratorBase, 'siteOutput'> & { siteOutput: Omit<ConfiguratorBase['siteOutput'], 'site_days'> };
  customerPrice: { amountIncGst: number; includesGst: true; currency: 'NZD'; breakdown: ConfiguratorPriceLine[] };
};

export function calculateFrozenConfiguratorPrice(draft: PreviewDraft, resolved: ResolvedPublishedCostingConfigurationV1): FrozenConfiguratorPrice | null {
  const design = parsePreviewDraft(draft);
  if (!design) return null;
  // Complete versioned schedules are required: never seed review constants in a public calculation.
  if (!resolved.config.accessoryRates || !resolved.config.installedSellingRates) return null;
  const calculation = calculateConfiguratorPricing(design, resolved.config), result = calculation.estimate;
  if (result.status !== 'priced' || result.excluded.length || !calculation.base || !calculation.siteInputs || !result.breakdown?.length) return null;
  const breakdown = result.breakdown.map(line => ({ label: line.label, amountIncGst: line.amount }));
  if (breakdown.some(line => !Number.isSafeInteger(line.amountIncGst) || line.amountIncGst < 0)
    || !Number.isSafeInteger(result.amount) || result.amount <= 0 || breakdown.reduce((n, line) => n + line.amountIncGst, 0) !== result.amount) return null;
  // Frozen v1 is a signed wire contract. New operational metadata belongs to the
  // full costing result, never to old immutable reference hashes. Copy only this
  // level so every historical nested field and module-derived day count remains.
  const siteOutput = { ...calculation.base.siteOutput };
  delete siteOutput.site_days;
  return { schemaVersion: 'configurator-pricing.v1', design, costingConfiguration: resolved.provenance,
    siteInputs: calculation.siteInputs, base: { ...calculation.base, siteOutput },
    customerPrice: { amountIncGst: result.amount, includesGst: true, currency: 'NZD', breakdown } };
}
