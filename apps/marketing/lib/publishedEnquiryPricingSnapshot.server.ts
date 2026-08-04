import 'server-only';

import {
  buildEnquiryPricingSnapshot,
  type EnquiryPricingParams,
  type EnquiryPricingSnapshot,
} from './enquiryPricingSnapshot';
import { getPublishedCostingConfiguration } from './publishedCostingConfiguration.server';

export async function buildPublishedEnquiryPricingSnapshot(
  params: EnquiryPricingParams,
): Promise<EnquiryPricingSnapshot> {
  try {
    const resolved = await getPublishedCostingConfiguration();
    return buildEnquiryPricingSnapshot(params, resolved);
  } catch {
    // Enquiry submission remains available, but costing never falls back to another version.
    return buildEnquiryPricingSnapshot(params, null);
  }
}
