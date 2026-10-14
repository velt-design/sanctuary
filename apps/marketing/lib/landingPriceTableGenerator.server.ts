import 'server-only';
import type { ResolvedPublishedCostingConfigurationV1 } from '@sp/costing/server';
import { productSelectionDraft } from '../components/products/productSelection';
import { INITIAL_PRODUCT_SELECTION } from '../components/products/productSelectionValues';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { landingPricePublicationKey, landingPriceTableId } from './landingPriceTableArtifact.server';
import { LANDING_PRICE_SCHEMA, LANDING_PRICE_TYPES, LANDING_PRICE_MATERIALS, type LandingPriceTable } from './landingPriceTable';

/** Build only. The returned artifact contains customer totals and identity, never private frozen calculations. */
export function generateLandingPriceTable(resolved: ResolvedPublishedCostingConfigurationV1): LandingPriceTable {
  if (!resolved.config.accessoryRates || !resolved.config.installedSellingRates) throw new Error('Incomplete published price schedules');
  const amounts: number[] = [];
  for (const type of LANDING_PRICE_TYPES) for (const material of LANDING_PRICE_MATERIALS)
    for (let widthMm = 1500; widthMm <= 10000; widthMm += 100) for (let projectionMm = 1500; projectionMm <= 6000; projectionMm += 100) {
      const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, material, widthMm, projectionMm }, type);
      // Do not price the draft's constrained projection when the customer's requested projection is unsupported.
      amounts.push(issue ? -1 : calculateFrozenConfiguratorPrice(draft, resolved)?.customerPrice.amountIncGst ?? 0);
    }
  const payload: Omit<LandingPriceTable, 'id'> = { schema: LANDING_PRICE_SCHEMA, versionId: resolved.provenance.versionId,
    versionNumber: resolved.provenance.versionNumber, publicationKey: landingPricePublicationKey(resolved.provenance), currency: 'NZD' as const, includesGst: true as const, amounts };
  return { ...payload, id: landingPriceTableId(payload) };
}
