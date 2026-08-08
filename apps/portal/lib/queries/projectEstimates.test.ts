import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateMetasByProjectQueryOptions } from './projectEstimates';
import { qk } from './keys';

const apiJson = vi.hoisted(() => vi.fn());

vi.mock('@/lib/repo/apiClient', () => ({ apiJson }));

describe('project estimate query bootstrap', () => {
  beforeEach(() => {
    apiJson.mockReset();
  });

  it('seeds the matching active draft detail in current-user memory', async () => {
    const activeMeta = {
      id: 'est_active',
      projectId: 'proj_1',
      createdAt: '2026-08-08T00:00:00.000Z',
      status: 'draft',
      summary: {},
      versionLabel: 'V2',
      isActiveDraft: true,
      hasSentQuote: false,
      jobPackEligible: false,
      jobPackGeneratedAt: null,
      jobPackQuoteVersionId: null,
    };
    const activeDraftEstimate = {
      ...activeMeta,
      calculatorSnapshot: { inputs: { modules: [] }, outputs: {} },
      editability: {
        isLocked: false,
        lockReason: null,
        lockedAt: null,
        lockedByQuoteVersionId: null,
        lockedByQuoteRef: null,
        lockedByQuoteVersionNumber: null,
        hasDraftQuotes: false,
        draftQuoteCount: 0,
      },
    };
    apiJson.mockResolvedValue({ estimates: [activeMeta], activeDraftEstimate });
    const client = new QueryClient();

    await expect(client.fetchQuery(
      estimateMetasByProjectQueryOptions('host', 'proj_1'),
    )).resolves.toEqual([activeMeta]);

    expect(client.getQueryData(qk.estimates.detail('host', 'est_active')))
      .toEqual(activeDraftEstimate);
  });

  it('does not seed a detail that does not match the requested project', async () => {
    apiJson.mockResolvedValue({
      estimates: [{ id: 'est_active', projectId: 'proj_1', isActiveDraft: true }],
      activeDraftEstimate: { id: 'est_active', projectId: 'proj_other' },
    });
    const client = new QueryClient();

    await client.fetchQuery(estimateMetasByProjectQueryOptions('host', 'proj_1'));

    expect(client.getQueryData(qk.estimates.detail('host', 'est_active'))).toBeUndefined();
  });
});
