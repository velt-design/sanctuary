import { describe, expect, it } from 'vitest';
import type { EstimateMeta } from '@/lib/estimates/types';
import { selectEstimateForCommercialScope } from './quotesTabModel';

function estimate(
  id: string,
  commercialScopeId: string | null,
  createdAt: string,
  isActiveDraft = false,
): EstimateMeta {
  return {
    id,
    projectId: 'proj-1',
    commercialScopeId,
    commercialScopeKind: commercialScopeId ? 'add_on' : 'base',
    internalName: null,
    createdAt,
    status: 'draft',
    versionLabel: 'V1',
    createdBy: null,
    summary: {},
    isActiveDraft,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
  };
}

describe('selectEstimateForCommercialScope', () => {
  it('keeps quote refresh within the selected add-on family', () => {
    const scopeId = '742b51d5-5f31-479b-8e5d-2276e53d5139';
    const selected = selectEstimateForCommercialScope([
      estimate('est-base', null, '2026-08-11T12:00:00.000Z', true),
      estimate('est-addon-old', scopeId, '2026-08-10T12:00:00.000Z'),
      estimate('est-addon-draft', scopeId, '2026-08-09T12:00:00.000Z', true),
    ], scopeId);

    expect(selected?.id).toBe('est-addon-draft');
  });
});
