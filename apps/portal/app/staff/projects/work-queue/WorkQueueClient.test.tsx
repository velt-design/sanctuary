import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';
import WorkQueueClient from './WorkQueueClient';

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  queryOptions: (options: unknown) => options,
  useQuery: queryMocks.useQuery,
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({ role: 'admin' }),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'portal.example',
  supabaseRuntimeUrl: () => 'https://portal.example',
}));

vi.mock('@/components/projects/workQueue/ProjectWorkQueueList', () => ({
  default: ({ entries }: { entries: unknown[] }) => (
    <div data-work-queue-list>{entries.length} projects</div>
  ),
}));

function queueResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { entries: [], generatedAt: '2026-07-29T00:00:00.000Z' },
    error: null,
    isFetching: false,
    refetch: queryMocks.refetch,
    ...overrides,
  };
}

describe('WorkQueueClient', () => {
  beforeEach(() => {
    queryMocks.useQuery.mockReset();
    queryMocks.refetch.mockReset();
    queryMocks.useQuery
      .mockReturnValueOnce(queueResult())
      .mockReturnValueOnce({
        data: [],
        error: null,
        isFetching: false,
      });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows an explicit pre-rollout state without legacy rows or migration links', () => {
    const error = new ApiError('Project Work unavailable', {
      status: 503,
      body: { code: 'WORK_ITEMS_UNAVAILABLE' },
    });
    queryMocks.useQuery
      .mockReset()
      .mockReturnValueOnce(queueResult({ data: undefined, error }))
      .mockReturnValueOnce({ data: [], error: null, isFetching: false });

    const rendered = renderIntoDocument(<WorkQueueClient />);

    expect(
      rendered.container.querySelector('[data-project-work-queue-state="not-ready"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain('Work Queue not ready');
    expect(rendered.container.textContent).toContain(
      'Existing projects and legacy tasks are unchanged.',
    );
    expect(rendered.container.querySelector('[data-work-queue-list]')).toBeNull();
    expect(rendered.container.textContent).not.toContain('Review old Contacted projects');
    expect(rendered.container.textContent).toContain('Retry');
    const queueOptions = queryMocks.useQuery.mock.calls[0]?.[0] as {
      retry: (failureCount: number, queryError: unknown) => boolean;
    };
    expect(queueOptions.retry(0, error)).toBe(false);
    rendered.unmount();
  });

  it('shows the legacy review link only after a successful queue read', () => {
    const rendered = renderIntoDocument(<WorkQueueClient />);

    expect(
      rendered.container.querySelector('[data-project-work-queue-state="fresh"]'),
    ).not.toBeNull();
    expect(rendered.container.querySelector('[data-work-queue-list]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Review old Contacted projects');
    rendered.unmount();
  });
});
