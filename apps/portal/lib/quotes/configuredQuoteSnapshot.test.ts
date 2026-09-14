import { describe, expect, it } from 'vitest';
import type { Estimate } from '../types/estimate';
import { buildQuoteLineItemsFromEstimate } from './mapping';
import { buildEstimatePayloadFromSiteCosting } from '../estimates/costingPayload';

function source(): Estimate {
  return { inputs: { schemaVersion: 'v2', modules: [{lengthM: '6'}] },
    derived: {pricingMode: 'configured_customer_snapshot'},
    outputs: {totals: {cost_ex_gst: 1000}, pricing_policy: {customer_price_multiplier: 9}},
    snapshot: {source: 'marketing_enquiry', configuredQuoteInputs: {modules: [{lengthM: '6'}], schemaVersion: 'v2'},
      frozenConfiguratorPrice: {schemaVersion: 'configurator-pricing.v1',
        base: {privateSupplyCost: 1000},
        customerPrice: {currency: 'NZD', includesGst: true, amountIncGst: 15000,
          breakdown: [{label: 'Pergola, roof & ceiling', amountIncGst: 12000},
            {label: 'Front 1 · Ziptrak', amountIncGst: 3000}]}}},
  } as unknown as Estimate;
}

describe('configured quote snapshot', () => {
  it('uses complete frozen selling cents without reapplying margins or GST', () => {
    const result = buildQuoteLineItemsFromEstimate(source());
    expect(result.blockingIssues).toEqual([]);
    expect(result.items.map(item => item.lineTotalIncGstCents)).toEqual([1200000, 300000]);
    expect(result.coreTotalIncCents).toBe(1500000);
    expect(JSON.stringify(result)).not.toContain('privateSupplyCost');
  });
  it('does not reuse the submitted amount after staff input changes', () => {
    const estimate = source();
    (estimate.inputs as any).modules[0].lengthM = '7';
    expect(buildQuoteLineItemsFromEstimate(estimate).items).toEqual([]);
    expect(buildQuoteLineItemsFromEstimate(estimate).blockingIssues).toHaveLength(1);
  });
  it.each([false, true])('blocks partial calculator repricing even when inputs changed: %s', changed => {
    const estimate = source();
    if (changed) (estimate.inputs as any).modules[0].lengthM = '7';
    const repriced = buildEstimatePayloadFromSiteCosting({
      basePayload: estimate,
      inputs: estimate.inputs,
      moduleIndex: 0,
      siteResult: { pergolas: [{modules: [{derived: {}}]}], totals: {cost_ex_gst: 1000} },
    } as unknown as Parameters<typeof buildEstimatePayloadFromSiteCosting>[0]);
    expect(repriced.derived).toEqual({});
    const result = buildQuoteLineItemsFromEstimate({ ...estimate, ...repriced } as Estimate);
    expect(result.items).toEqual([]);
    expect(result.blockingIssues.map(issue => issue.code)).toEqual(['CONFIGURED_COSTING_REVIEW_REQUIRED']);
  });
  it.each(['total', 'currency', 'gst', 'missing-basis', 'negative', 'fraction', 'empty'])('blocks malformed or incomplete %s evidence', failure => {
    const estimate = source();
    const snapshot = estimate.snapshot as any;
    const price = snapshot.frozenConfiguratorPrice.customerPrice;
    if (failure === 'total') price.amountIncGst += 1;
    if (failure === 'currency') price.currency = 'USD';
    if (failure === 'gst') price.includesGst = false;
    if (failure === 'missing-basis') delete snapshot.configuredQuoteInputs;
    if (failure === 'negative') price.breakdown[1].amountIncGst = -3000;
    if (failure === 'fraction') price.breakdown[1].amountIncGst = 3000.2;
    if (failure === 'empty') price.breakdown = [];
    const result = buildQuoteLineItemsFromEstimate(estimate);
    expect(result.items).toEqual([]);
    expect(result.blockingIssues).toHaveLength(1);
  });
});
