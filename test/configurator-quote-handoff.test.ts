import { expect, it } from 'vitest';
import { ACCESSORY_REVIEW_RATES, applyCostingControlConfigV1, getDefaultInstalledSellingRates, loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { hashCostingControlConfigV1, type ResolvedPublishedCostingConfigurationV1 } from '@sp/costing/server';
import { calculateFrozenConfiguratorPrice } from '../apps/marketing/lib/configuratorPricing.server';
import { buildEnquiryDraftEstimateRow, buildEnquiryPricingSnapshot, type EnquiryPricingParams } from '../apps/marketing/lib/enquiryPricingSnapshot';
import { defaultBlind } from '../apps/marketing/components/configurator-prototype/blindCatalog';
import { previewBlindOpenings } from '../apps/marketing/components/configurator-prototype/blindSelection';
import type { PreviewDraft } from '../apps/marketing/components/configurator-prototype/previewDraft.types';
import { mapQuoteSourceEstimateRow } from '../apps/portal/lib/quotes/serverLoaders';
import { buildQuoteLineItemsFromEstimate } from '../apps/portal/lib/quotes/mapping';
import { buildStaffConfiguratorRevisionEstimate } from '../apps/marketing/lib/staffConfiguratorRevisionEstimate.server';

it('carries a complete configured selling price through intake persistence and staff quote loading', () => {
  const base = loadCostingConfigV1(), control = snapshotCostingControlConfigV1(base);
  control.accessoryRates = structuredClone(ACCESSORY_REVIEW_RATES);
  control.installedSellingRates = getDefaultInstalledSellingRates();
  const resolved = {config: applyCostingControlConfigV1(base, control), provenance: {
    schemaVersion: 'costing-provenance.v1', source: 'published', versionId: '11111111-1111-4111-8111-111111111111',
    versionNumber: 7, configHash: hashCostingControlConfigV1(control),
  }} as ResolvedPublishedCostingConfigurationV1;
  const design: PreviewDraft = {version: 1, input: {widthMm: 5000, projectionMm: 3000, connection: 'facade', level: 'ground'},
    roof: {family: 'gable', orientation: 'parallel', infills: false}};
  design.roof.blinds = [defaultBlind(previewBlindOpenings(design.input, design.roof)[0].id)];
  const frozen = calculateFrozenConfiguratorPrice(design, resolved)!;
  expect(frozen).not.toBeNull();
  const params: EnquiryPricingParams = {enquiryType: 'residential', name: 'Test', suburb: 'Auckland', widthM: 5,
    depthM: 3, heightM: null, style: 'gable', roofMaterials: ['acrylic'], addOns: {}};
  const pricing = buildEnquiryPricingSnapshot(params, resolved, {verifiedConfigurator: frozen});
  const row = buildEnquiryDraftEstimateRow({...params, pricing, projectId: null, createdBy: 'test', email: '', phoneRaw: '', message: ''});
  // JSON round-trip models the persisted payload, including the original input basis.
  const estimate = mapQuoteSourceEstimateRow(JSON.parse(JSON.stringify(row)));
  const quote = buildQuoteLineItemsFromEstimate(estimate);
  expect(quote.blockingIssues).toEqual([]);
  expect(quote.items.map(item => ({label: item.description, amountIncGst: item.lineTotalIncGstCents / 100})))
    .toEqual(frozen.customerPrice.breakdown.filter(line => line.amountIncGst > 0));
  expect(quote.coreTotalIncCents).toBe(frozen.customerPrice.amountIncGst * 100);
  expect(quote.items.some(item => item.description.includes('Ziptrak'))).toBe(true);
  expect(JSON.stringify(quote)).not.toContain('installerTopUpExGst');
  const original = JSON.stringify(row);
  const revisedDesign = structuredClone(design);
  revisedDesign.input.widthMm = 6000;
  const revisedPrice = calculateFrozenConfiguratorPrice(revisedDesign, resolved)!;
  expect(revisedPrice).not.toBeNull();
  const revisedRow = buildStaffConfiguratorRevisionEstimate({projectId: 'project-1', sourceEstimateId: 'estimate-1',
    actorId: 'staff-1', sourceSnapshot: (row.outputs as any).snapshot, frozen: revisedPrice});
  const revisedQuote = buildQuoteLineItemsFromEstimate(mapQuoteSourceEstimateRow(JSON.parse(JSON.stringify(revisedRow))));
  expect(revisedQuote.blockingIssues).toEqual([]);
  expect(revisedQuote.coreTotalIncCents).toBe(revisedPrice.customerPrice.amountIncGst * 100);
  expect(revisedQuote.items.some(item => item.description.includes('Ziptrak'))).toBe(true);
  expect((revisedRow.outputs as any).snapshot.frozenConfiguratorPrice.design.input.widthMm).toBe(6000);
  expect(JSON.stringify(row)).toBe(original);
});
