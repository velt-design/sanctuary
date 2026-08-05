import 'server-only';

import {
  buildEnquiryPricingSnapshot,
  type EnquiryPricingParams,
  type EnquiryPricingSnapshot,
} from './enquiryPricingSnapshot';
import {
  getPublishedCostingConfiguration,
  getPublishedCostingConfigurationByProvenance,
} from './publishedCostingConfiguration.server';
import {
  frozenSimpleCoverHashesMatch,
  hashFrozenSimpleCoverPricingResult,
  readSimpleCoverCalculationRef,
} from './simpleCoverCalculationRef.server';
import { calculateFrozenSimpleCoverPricingWithConfiguration } from './simpleCoverPricing.server';

export type PublishedEnquiryPricingOptions = {
  calculationRef?: string | null;
  /** A calculator journey without a verified ref must not synthesize a generic price. */
  suppressGenericPricing?: boolean;
};

export async function buildPublishedEnquiryPricingSnapshot(
  params: EnquiryPricingParams,
  options: PublishedEnquiryPricingOptions = {},
): Promise<EnquiryPricingSnapshot> {
  const claims = readSimpleCoverCalculationRef(options.calculationRef);
  if (claims) {
    try {
      const resolved = await getPublishedCostingConfigurationByProvenance(
        claims.costingConfiguration,
      );
      const frozen = calculateFrozenSimpleCoverPricingWithConfiguration(
        claims.input,
        resolved,
      );
      const recomputedHash = hashFrozenSimpleCoverPricingResult(frozen);
      if (frozenSimpleCoverHashesMatch(claims.frozenResultHash, recomputedHash)) {
        return buildEnquiryPricingSnapshot(params, resolved, {
          verifiedSimpleCover: frozen,
        });
      }
    } catch {
      // The enquiry remains available, but an unverified reference cannot carry pricing.
    }
  }

  if (options.suppressGenericPricing || Boolean(options.calculationRef)) {
    return buildEnquiryPricingSnapshot(params, null, { suppressGenericPricing: true });
  }

  try {
    const resolved = await getPublishedCostingConfiguration();
    return buildEnquiryPricingSnapshot(params, resolved);
  } catch {
    // Enquiry submission remains available, but costing never falls back to another version.
    return buildEnquiryPricingSnapshot(params, null);
  }
}
