import 'server-only';

import {
  calculateCustomerPriceFromCostEx,
  calculateSiteCostV1,
  type SiteOutputV1,
} from '@sp/costing';
import type {
  PublishedCostingConfigurationProvenanceV1,
  ResolvedPublishedCostingConfigurationV1,
} from '@sp/costing/server';
import { roundMarketingCustomerPrice } from './enquiryEstimate';
import { getPublishedCostingConfiguration } from './publishedCostingConfiguration.server';
import { issueSimpleCoverCalculationRef } from './simpleCoverCalculationRef.server';
import {
  buildSimpleCoverPlan,
  buildSimpleCoverSiteInputs,
  getSimpleCoverCustomResult,
  simpleCoverAreaM2,
  simpleCoverPostCount,
  type SimpleCoverInput,
  type FrozenSimpleCoverPricedResult,
  type SimpleCoverPublicResult,
} from './simpleCoverCalculator';

export type FrozenSimpleCoverPricingResult = {
  schemaVersion: 'simple-cover-pricing.v1';
  input: SimpleCoverInput;
  siteInputs: ReturnType<typeof buildSimpleCoverSiteInputs>;
  siteOutput: SiteOutputV1;
  customerPrice: {
    exactExGst: number;
    exactIncGst: number;
    displayedFromIncGst: number;
  };
  costingConfiguration: PublishedCostingConfigurationProvenanceV1;
  publicResult: FrozenSimpleCoverPricedResult;
};

export function calculateFrozenSimpleCoverPricingWithConfiguration(
  input: SimpleCoverInput,
  resolved: ResolvedPublishedCostingConfigurationV1,
): FrozenSimpleCoverPricingResult {
  const siteInputs = buildSimpleCoverSiteInputs(input);
  const siteOutput = calculateSiteCostV1(siteInputs, resolved.config);
  const customerPrice = calculateCustomerPriceFromCostEx(
    siteOutput.totals.cost_ex_gst,
    0,
    siteOutput.pricing_policy?.customer_price_uplift_pct,
    siteOutput.pricing_policy?.customer_price_multiplier,
  );
  if (!customerPrice || customerPrice.incGst <= 0) {
    throw new Error('Customer price could not be calculated.');
  }

  const displayedFromIncGst = roundMarketingCustomerPrice(customerPrice.incGst, 'residential');
  if (displayedFromIncGst <= 0) throw new Error('Customer price could not be displayed.');

  const postCount = simpleCoverPostCount(input.widthMm);
  const publicResult: FrozenSimpleCoverPricedResult = {
    ok: true,
    status: 'priced',
    input,
    areaM2: simpleCoverAreaM2(input),
    postCount,
    postSpacingMm: Math.round(input.widthMm / (postCount - 1)),
    plan: buildSimpleCoverPlan(input.widthMm, postCount),
    price: {
      fromIncGst: displayedFromIncGst,
      currency: 'NZD',
    },
    configuration: {
      versionNumber: resolved.provenance.versionNumber,
    },
  };

  return {
    schemaVersion: 'simple-cover-pricing.v1',
    input,
    siteInputs,
    siteOutput,
    customerPrice: {
      exactExGst: customerPrice.exGst,
      exactIncGst: customerPrice.incGst,
      displayedFromIncGst,
    },
    costingConfiguration: resolved.provenance,
    publicResult,
  };
}

export async function calculateFrozenSimpleCoverPricing(
  input: SimpleCoverInput,
): Promise<FrozenSimpleCoverPricingResult> {
  return calculateFrozenSimpleCoverPricingWithConfiguration(
    input,
    await getPublishedCostingConfiguration(),
  );
}

export async function calculateSimpleCoverPublicResult(
  input: SimpleCoverInput,
): Promise<SimpleCoverPublicResult> {
  const custom = getSimpleCoverCustomResult(input);
  if (custom) return custom;
  const frozen = await calculateFrozenSimpleCoverPricing(input);
  return {
    ...frozen.publicResult,
    calculationRef: issueSimpleCoverCalculationRef(frozen),
  };
}
