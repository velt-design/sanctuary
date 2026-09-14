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
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
import { hashConfiguratorDesign, readConfiguratorCalculationRef } from './configuratorCalculationRef.server';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { calculationHashesMatch, hashCalculationValue } from './calculationRefCodec.server';

export type PublishedEnquiryPricingOptions = {
  calculationRef?: string | null;
  /** A calculator journey without a verified ref must not synthesize a generic price. */
  suppressGenericPricing?: boolean;
  design?: PreviewDraft;
};

export async function buildPublishedEnquiryPricingSnapshot(
  params: EnquiryPricingParams,
  options: PublishedEnquiryPricingOptions = {},
): Promise<EnquiryPricingSnapshot> {
  if (options.calculationRef?.startsWith('cf1.')) {
    try {
      const claims = readConfiguratorCalculationRef(options.calculationRef);
      if (claims && options.design && calculationHashesMatch(claims.designHash, hashConfiguratorDesign(options.design))) {
        // A signed older reference may resolve its original immutable version after publication changes.
        const resolved = await getPublishedCostingConfigurationByProvenance(claims.costingConfiguration);
        const frozen = calculateFrozenConfiguratorPrice(options.design, resolved);
        if (frozen && calculationHashesMatch(claims.frozenResultHash, hashCalculationValue(frozen)))
          return buildEnquiryPricingSnapshot(params, resolved, { verifiedConfigurator: frozen });
      }
    } catch { /* Keep the enquiry available without trusting an unverifiable price. */ }
    return buildEnquiryPricingSnapshot(params, null, { suppressGenericPricing: true });
  }
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
