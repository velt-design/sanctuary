import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';
import LegacyContactedReviewClient from './LegacyContactedReviewClient';

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: queryMocks.useQuery,
  useQueryClient: () => ({
    invalidateQueries: queryMocks.invalidateQueries,
  }),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'portal.example',
  supabaseRuntimeUrl: () => 'https://portal.example',
}));

vi.mock('./LegacyContactedMigrationForm', () => ({
  default: () => <div data-migration-form />,
}));

describe('LegacyContactedReviewClient', () => {
  beforeEach(() => {
    queryMocks.useQuery.mockReset();
    queryMocks.refetch.mockReset();
    queryMocks.invalidateQueries.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows a safe not-ready state when the V2 review schema is unavailable', () => {
    const error = new ApiError('Project Work unavailable', {
      status: 503,
      body: { code: 'WORK_ITEMS_UNAVAILABLE' },
    });
    queryMocks.useQuery.mockReturnValue({
      data: undefined,
      error,
      isFetching: false,
      refetch: queryMocks.refetch,
    });

    const rendered = renderIntoDocument(<LegacyContactedReviewClient />);

    expect(
      rendered.container.querySelector('[data-legacy-contacted-review-state="not-ready"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain('Legacy review not ready');
    expect(rendered.container.textContent).toContain('No old project has been changed.');
    expect(rendered.container.textContent).toContain('Back to Work Queue');
    expect(rendered.container.textContent).toContain('Retry');
    expect(rendered.container.textContent).not.toContain('This is a controlled migration');
    expect(rendered.container.querySelector('[aria-label="Legacy review controls"]')).toBeNull();
    const queryOptions = queryMocks.useQuery.mock.calls[0]?.[0] as {
      retry: (failureCount: number, queryError: unknown) => boolean;
    };
    expect(queryOptions.retry(0, error)).toBe(false);
    rendered.unmount();
  });
});
