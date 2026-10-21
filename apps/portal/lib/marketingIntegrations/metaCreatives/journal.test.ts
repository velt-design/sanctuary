import { describe, expect, it } from 'vitest';
import { creativePlanSchema, creativeLedgerEffectSchema, nextCreativeEffect } from './journal';
const hash = 'a'.repeat(64), uuid = '10000000-0000-4000-8000-000000000001';
describe('separate creative durable contracts', () => {
  it('never treats uncertainty or a changed request as permission to dispatch again', () => {
    expect(nextCreativeEffect(null, hash)).toBe('requires_source_admission');
    expect(nextCreativeEffect({ state: 'uncertain', requestHash: hash, objectId: null }, hash)).toBe('reconcile_only');
    expect(nextCreativeEffect({ state: 'prepared', requestHash: hash, objectId: null }, hash)).toBe('reconcile_only');
    expect(nextCreativeEffect({ state: 'no_effect', requestHash: hash, objectId: null }, hash)).toBe('read_no_effect');
    expect(nextCreativeEffect({ state: 'no_effect', requestHash: hash, objectId: null }, 'b'.repeat(64))).toBe('conflict');
    expect(nextCreativeEffect({ state: 'confirmed', requestHash: hash, objectId: '1001' }, hash)).toBe('read_confirmed');
    expect(nextCreativeEffect({ state: 'confirmed', requestHash: hash, objectId: '1001' }, 'b'.repeat(64))).toBe('conflict');
  });
  it('requires four distinct original ads and independent exact approval', () => {
    const plan = { scope: { app: '11', principal: '12', business: '13', account: '14', page: '15', campaign: '16', adset: '17' },
      originalAds: ['21','22','23','24'], approvalHash: hash, catalogueHash: hash, controlHash: hash, budgetHash: hash,
      nativeContractHash: hash, generator: 'author', reviewer: 'reviewer' };
    expect(creativePlanSchema.safeParse(plan).success).toBe(true);
    expect(creativePlanSchema.safeParse({ ...plan, originalAds: ['21','21','23','24'] }).success).toBe(false);
    expect(creativePlanSchema.safeParse({ ...plan, reviewer: 'author' }).success).toBe(false);
    expect(creativePlanSchema.safeParse({ ...plan, budget: 500 }).success).toBe(false);
  });
  it('rejects speculative wire fields and provider credential material', () => {
    const effect = { command: uuid, experiment: uuid, requestHash: hash, generation: 1, kind: 'create_paused_ad', objectId: null,
      preStateHash: hash, observedAt: '2026-10-21T00:00:00Z' };
    expect(creativeLedgerEffectSchema.safeParse(effect).success).toBe(true);
    for (const key of ['access_token','targeting','daily_budget','creative_test_config']) expect(creativeLedgerEffectSchema.safeParse({ ...effect, [key]: 'forbidden' }).success).toBe(false);
  });
});
