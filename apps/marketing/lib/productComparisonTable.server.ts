import 'server-only';
import { getPublishedCostingConfiguration } from './publishedCostingConfiguration.server';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { INITIAL_PRODUCT_SELECTION, productSelectionDraft } from '../components/products/productSelection';
import { PRODUCT_FORM_CHOICES } from '../components/products/productDesigns';
import { COMPARISON_SIZES, comparisonSizeKey, type ProductComparisonTable } from '../components/products/productComparisonTable';

// One public snapshot only. Publication and release approval are checked before every cache read.
let cached: { key: string; table: Extract<ProductComparisonTable, { status: 'priced' }> } | undefined;

export async function getProductComparisonTable(): Promise<ProductComparisonTable> {
  if (process.env.NODE_ENV === 'development' && ['v2.8', 'v2.9'].includes(process.env.CONFIGURATOR_LOCAL_PRICING_CANDIDATE ?? '')) return { status: 'disabled' };
  const approvedVersion = process.env.WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID?.trim();
  if (!approvedVersion) return { status: 'disabled' };
  try {
    const resolved = await getPublishedCostingConfiguration();
    if (resolved.provenance.versionId !== approvedVersion) return { status: 'unavailable' };
    const key = JSON.stringify(resolved.provenance);
    if (cached?.key === key) return cached.table;
    const amounts: Extract<ProductComparisonTable, { status: 'priced' }>['amounts'] = {};
    for (const [widthMm, projectionMm] of COMPARISON_SIZES) {
      const row = {} as Record<typeof PRODUCT_FORM_CHOICES[number]['type'], number>;
      for (const { type } of PRODUCT_FORM_CHOICES) {
        const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, widthMm, projectionMm }, type);
        if (issue || widthMm * projectionMm > 30_000_000) return { status: 'unavailable' };
        const frozen = calculateFrozenConfiguratorPrice(draft, resolved);
        if (!frozen || !Number.isSafeInteger(frozen.customerPrice.amountIncGst) || frozen.customerPrice.amountIncGst <= 0) return { status: 'unavailable' };
        row[type] = frozen.customerPrice.amountIncGst;
      }
      amounts[comparisonSizeKey(widthMm, projectionMm)] = row;
    }
    const table = { status: 'priced' as const, versionNumber: resolved.provenance.versionNumber, amounts };
    cached = { key, table };
    return table;
  } catch { return { status: 'unavailable' }; }
}
