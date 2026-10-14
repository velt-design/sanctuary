import type { MetaSaleStatus } from '@/lib/marketingIntegrations/metaSales/contract';
export async function metaSaleFixtureLoader(): Promise<MetaSaleStatus> {
  const mode = new URLSearchParams(window.location.search).get('metaSales');
  if (mode === 'failure') throw new Error('Synthetic unavailable evidence');
  const attention = mode === 'attention';
  return { enabled: mode === 'active' || mode === 'expired', deliveryAuthority: mode==='expired'?'CREDENTIAL_EXPIRED':mode==='active'?'READY':'DISABLED', mode: 'canary', datasetId: '123', checkedAt: new Date().toISOString(),
    ...(mode==='renewal'?{credentials:{reports:{state:'RECONCILIATION_REQUIRED' as const,tokenExpiresAt:'2026-11-01T00:00:00Z',dataAccessExpiresAt:null,
      approvalEndsAt:'2026-10-30T00:00:00Z',assetVerifiedAt:'2026-10-14T00:00:00Z',checkedAt:'2026-10-14T01:00:00Z'}}}:{}),
    lastCompletedAt: null, error: attention ? 'META_SALE_RUN_REQUIRES_REVIEW' : null, pending: attention ? 'EXPIRED' : 'NONE',
    counts: attention ? { ACCEPTED: 2, REVIEW_REQUIRED: 1, RETRY: 1 } : {}, reasons: attention ? { SENT_SALE_SOURCE_CHANGED: 1 } : {},
    assessedCount: 6, assessedAt: new Date().toISOString(), assessmentReasons: { META_EVENT_WINDOW_EXCEEDED: 4, META_DISCLOSURE_NOT_PRESENT: 5, ORIGIN_ENQUIRY_MISSING: 1 }, warningCount: 0 };
}
