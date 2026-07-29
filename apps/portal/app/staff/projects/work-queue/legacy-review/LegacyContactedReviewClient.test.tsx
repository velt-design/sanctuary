import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';
import LegacyContactedReviewClient from './LegacyContactedReviewClient';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
  invalidateProjectWorkReads: vi.fn(async () => undefined),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => ({}),
}));

vi.mock('@/lib/queries/projectWorkCache', () => ({
  invalidateProjectWorkReads: mocks.invalidateProjectWorkReads,
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'portal.example',
  supabaseRuntimeUrl: () => 'https://portal.example',
}));

vi.mock('./LegacyContactedMigrationForm', () => ({
  default: ({ onSaved }: { onSaved: (message: string) => void }) => (
    <button type="button" onClick={() => onSaved('Migrated safely')}>
      Complete mock migration
    </button>
  ),
}));

function freshReview() {
  return {
    data: {
      projects: [{
        projectId: 'proj_1',
        projectName: 'Fixture project',
        pipelineStage: 'contacted',
        updatedAt: '2026-07-29T00:00:00.000Z',
        evidenceFingerprint: 'fingerprint',
        followUpDate: null,
        recommendation: 'MANUAL_CLASSIFICATION',
        reasonCodes: ['INSUFFICIENT_EVIDENCE'],
        evidence: {
          currentQuote: false,
          currentInvoice: false,
          currentDesign: false,
          currentSchedule: false,
          runningJob: false,
          openObligation: false,
          sentEmail: false,
        },
      }],
      summary: {
        total: 1,
        due: 1,
        archived: 0,
        byRecommendation: {
          ACTIVE_EVIDENCE: 0,
          WAITING_CANDIDATE: 0,
          LOST_NO_RESPONSE_CANDIDATE: 0,
          MANUAL_CLASSIFICATION: 1,
        },
      },
      generatedAt: '2026-07-29T00:00:00.000Z',
      nextCursor: null,
    },
    error: null,
    isFetching: false,
    refetch: mocks.refetch,
  };
}

describe('LegacyContactedReviewClient', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.refetch.mockReset().mockResolvedValue(undefined);
    mocks.invalidateProjectWorkReads.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows a safe not-ready state when the V2 review schema is unavailable', () => {
    const error = new ApiError('Project Work unavailable', {
      status: 503,
      body: { code: 'WORK_ITEMS_UNAVAILABLE' },
    });
    mocks.useQuery.mockReturnValue({
      data: undefined,
      error,
      isFetching: false,
      refetch: mocks.refetch,
    });

    const rendered = renderIntoDocument(<LegacyContactedReviewClient />);

    expect(
      rendered.container.querySelector('[data-legacy-contacted-review-state="not-ready"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain('Legacy review not ready');
    expect(rendered.container.textContent).toContain('No old project has been changed.');
    expect(rendered.container.querySelector('[aria-label="Legacy review controls"]')).toBeNull();
    const queryOptions = mocks.useQuery.mock.calls[0]?.[0] as {
      retry: (failureCount: number, queryError: unknown) => boolean;
    };
    expect(queryOptions.retry(0, error)).toBe(false);
    rendered.unmount();
  });

  it('invalidates the migrated project and every global Project Work consumer', async () => {
    mocks.useQuery.mockReturnValue(freshReview());
    const rendered = renderIntoDocument(<LegacyContactedReviewClient />);
    const review = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Review one project'));
    expect(review).toBeTruthy();

    await act(async () => {
      review!.click();
    });
    const migrate = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Complete mock migration'));
    expect(migrate).toBeTruthy();

    await act(async () => {
      migrate!.click();
      await Promise.resolve();
    });

    expect(mocks.invalidateProjectWorkReads).toHaveBeenCalledWith(
      {},
      'portal.example',
      'proj_1',
    );
    expect(mocks.refetch).toHaveBeenCalled();
    rendered.unmount();
  });
});
