import { describe, expect, it } from 'vitest';
import {
  buildQuotePricingSourceCopyFromEstimate,
  buildQuotePricingSourceCopyFromQuoteVersion,
  compactPricingSourceMetadata,
  protectedQuoteVersionRefreshReason,
} from './pricingSource';

describe('quote pricing source metadata', () => {
  it('copies only compact allowlisted estimate metadata', () => {
    const copy = buildQuotePricingSourceCopyFromEstimate({
      estimate: {
        pricing_source: 'workbench_solved',
        pricing_source_metadata: {
          gateVersion: 'estimate_pricing_rollout_prep_v1',
          selectedSource: 'workbench_solved',
          quantityTakeoffSource: 'solved_geometry_spine',
          trustSummary: { status: 'ready', blockingDiagnostics: 0, commercial_design_input: { raw: true } },
          commercialInputHash: 'hash-commercial',
          parityReportHash: 'hash-parity',
          commercial_design_input: { raw: true },
          oversizedCommercialPayload: { shouldNotCopy: true },
        },
      },
      sourceEstimateVersionId: 'est-1',
      copiedAt: '2026-05-04T00:00:00.000Z',
      copiedBy: 'ops@example.com',
      copyReason: 'quote_created',
    });

    expect(copy.pricingSource).toBe('workbench_solved');
    expect(copy.pricingSourceMetadata).toMatchObject({
      gateVersion: 'estimate_pricing_rollout_prep_v1',
      selectedSource: 'workbench_solved',
      quantityTakeoffSource: 'solved_geometry_spine',
      trustSummary: { status: 'ready', blockingDiagnostics: 0 },
      commercialInputHash: 'hash-commercial',
      parityReportHash: 'hash-parity',
      sourceEstimateVersionId: 'est-1',
      copiedAt: '2026-05-04T00:00:00.000Z',
      copiedBy: 'ops@example.com',
      copyReason: 'quote_created',
    });
    expect(copy.pricingSourceMetadata).not.toHaveProperty('commercial_design_input');
    expect(copy.pricingSourceMetadata).not.toHaveProperty('oversizedCommercialPayload');
    expect(copy.pricingSourceMetadata.trustSummary).not.toHaveProperty('commercial_design_input');
    expect(copy.sourceMetadataHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('copies compact calculator rollback provenance for draft refreshes', () => {
    const copy = buildQuotePricingSourceCopyFromEstimate({
      estimate: {
        pricing_source: 'calculator_live',
        pricing_source_metadata: {
          gateVersion: 'estimate_pricing_rollout_prep_v1',
          requestedSource: 'calculator_live',
          selectedSource: 'calculator_live',
          rollbackProvenance: 'ops rollback 2026-05-04',
          blockingGateCodes: ['WORKBENCH_PARITY_BLOCKED', '', null],
          commercialInputHash: 'hash-commercial',
          parityReportHash: 'hash-parity',
          oversizedCommercialPayload: { lines: Array.from({ length: 50 }, (_, idx) => ({ idx })) },
        },
      },
      sourceEstimateVersionId: 'est-rollback',
      copiedAt: '2026-05-04T00:00:00.000Z',
      copiedBy: 'ops@example.com',
      copyReason: 'quote_refreshed_from_estimate',
    });

    expect(copy.pricingSource).toBe('calculator_live');
    expect(copy.pricingSourceMetadata).toMatchObject({
      gateVersion: 'estimate_pricing_rollout_prep_v1',
      requestedSource: 'calculator_live',
      selectedSource: 'calculator_live',
      rollbackProvenance: 'ops rollback 2026-05-04',
      blockingGateCodes: ['WORKBENCH_PARITY_BLOCKED'],
      commercialInputHash: 'hash-commercial',
      parityReportHash: 'hash-parity',
      sourceEstimateVersionId: 'est-rollback',
      copyReason: 'quote_refreshed_from_estimate',
    });
    expect(copy.pricingSourceMetadata).not.toHaveProperty('oversizedCommercialPayload');
    expect(JSON.stringify(copy.pricingSourceMetadata)).not.toContain('commercial_design_input');
  });

  it('normalizes missing or invalid estimate source to calculator_live', () => {
    const copy = buildQuotePricingSourceCopyFromEstimate({
      estimate: {
        pricing_source: 'browser_selected_payload',
        pricing_source_metadata: { selectedSource: 'browser_selected_payload' },
      },
      sourceEstimateVersionId: 'est-1',
      copiedAt: '2026-05-04T00:00:00.000Z',
      copiedBy: null,
      copyReason: 'quote_refreshed_from_estimate',
    });

    expect(copy.pricingSource).toBe('calculator_live');
    expect(copy.pricingSourceMetadata.selectedSource).toBe('browser_selected_payload');
  });

  it('produces a stable metadata hash independent of copy provenance', () => {
    const base = {
      estimate: {
        pricing_source: 'calculator_live',
        pricing_source_metadata: {
          gateVersion: 'estimate_pricing_rollout_prep_v1',
          selectedSource: 'calculator_live',
        },
      },
      sourceEstimateVersionId: 'est-1',
    };

    const first = buildQuotePricingSourceCopyFromEstimate({
      ...base,
      copiedAt: '2026-05-04T00:00:00.000Z',
      copiedBy: 'a@example.com',
      copyReason: 'quote_created',
    });
    const second = buildQuotePricingSourceCopyFromEstimate({
      ...base,
      copiedAt: '2026-05-05T00:00:00.000Z',
      copiedBy: 'b@example.com',
      copyReason: 'quote_refreshed_from_estimate',
    });

    expect(second.sourceMetadataHash).toBe(first.sourceMetadataHash);
  });

  it('preserves prior quote metadata when creating a revision draft', () => {
    const copy = buildQuotePricingSourceCopyFromQuoteVersion({
      quoteVersion: {
        pricing_source: 'workbench_solved',
        source_estimate_version_id: 'est-2',
        pricing_source_metadata: {
          selectedSource: 'workbench_solved',
          parityReportHash: 'parity-hash',
          commercial_design_input: { raw: true },
        },
      },
      copiedAt: '2026-05-04T00:00:00.000Z',
      copiedBy: 'ops@example.com',
      copyReason: 'quote_revised',
      revisedFromQuoteVersionId: 'qv-1',
    });

    expect(copy).not.toBeNull();
    expect(copy?.pricingSource).toBe('workbench_solved');
    expect(copy?.pricingSourceMetadata).toMatchObject({
      selectedSource: 'workbench_solved',
      parityReportHash: 'parity-hash',
      sourceEstimateVersionId: 'est-2',
      copyReason: 'quote_revised',
      revisedFromQuoteVersionId: 'qv-1',
    });
    expect(copy?.pricingSourceMetadata).not.toHaveProperty('commercial_design_input');
  });

  it('uses the three quote copy reasons without adding raw payload fields', () => {
    const reasons = ['quote_created', 'quote_refreshed_from_estimate', 'quote_revised'] as const;

    for (const reason of reasons) {
      const copy = buildQuotePricingSourceCopyFromEstimate({
        estimate: {
          pricing_source: 'workbench_solved',
          pricing_source_metadata: {
            selectedSource: 'workbench_solved',
            commercialInputHash: 'hash-only',
            commercial_design_input: { raw: true },
          },
        },
        sourceEstimateVersionId: 'est-1',
        copiedAt: '2026-05-04T00:00:00.000Z',
        copiedBy: 'ops@example.com',
        copyReason: reason,
      });

      expect(copy.pricingSourceMetadata.copyReason).toBe(reason);
      expect(copy.pricingSourceMetadata.commercialInputHash).toBe('hash-only');
      expect(JSON.stringify(copy.pricingSourceMetadata)).not.toContain('commercial_design_input');
    }
  });

  it('keeps refresh protection explicit for historical quote states and downstream records', () => {
    expect(protectedQuoteVersionRefreshReason({ status: 'SENT' })).toBe('status_locked');
    expect(protectedQuoteVersionRefreshReason({ status: 'ACCEPTED' })).toBe('status_locked');
    expect(protectedQuoteVersionRefreshReason({ status: 'DECLINED' })).toBe('status_locked');
    expect(protectedQuoteVersionRefreshReason({ status: 'SUPERSEDED' })).toBe('status_locked');
    expect(protectedQuoteVersionRefreshReason({ status: 'DRAFT', hasDepositInvoice: true })).toBe('invoice_backed');
    expect(protectedQuoteVersionRefreshReason({ status: 'DRAFT', hasJobPackGeneration: true })).toBe('job_pack_backed');
    expect(protectedQuoteVersionRefreshReason({ status: 'DRAFT' })).toBeNull();
  });
});

describe('compactPricingSourceMetadata', () => {
  it('strips raw commercial payload keys from nested quote source metadata input', () => {
    expect(
      compactPricingSourceMetadata({
        commercialInputHash: 'hash-only',
        commercial_design_input: { raw: true },
        serviceRoleKey: 'secret',
      }),
    ).toEqual({ commercialInputHash: 'hash-only' });
  });
});
