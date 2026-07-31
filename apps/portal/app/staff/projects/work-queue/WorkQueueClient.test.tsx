import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/repo/apiClient';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import WorkQueueClient from './WorkQueueClient';

const useQueryMock = vi.fn();
const queueRefetch = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
    <a {...props}>{children ?? null}</a>,
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
  };
});

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://host.supabase.co',
}));

vi.mock('@/components/projects/workQueue/PaginatedProjectWorkQueueList.client', () => ({
  default: ({
    entries,
    mutationsEnabled,
    reassignmentEnabled,
  }: {
    entries: unknown[];
    mutationsEnabled: boolean;
    reassignmentEnabled: boolean;
  }) => (
    <div
      data-testid="queue-list"
      data-entry-count={entries.length}
      data-mutations-enabled={String(mutationsEnabled)}
      data-reassignment-enabled={String(reassignmentEnabled)}
    />
  ),
}));

function queryState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isFetching: false,
    isSuccess: false,
    refetch: queueRefetch,
    ...overrides,
  };
}

describe('WorkQueueClient', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useQueryMock.mockReset();
    queueRefetch.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fails closed with a named pre-rollout state and does not expose migration controls', () => {
    const notReady = new ApiError('Schema unavailable', {
      status: 503,
      body: { code: 'WORK_ITEMS_UNAVAILABLE' },
    });
    useQueryMock
      .mockReturnValueOnce(queryState({
        data: { entries: [{ projectId: 'stale' }], generatedAt: '2026-07-29T00:00:00Z' },
        error: notReady,
      }))
      .mockReturnValueOnce(queryState({ data: [], isSuccess: true }));

    const rendered = renderIntoDocument(<WorkQueueClient />);

    expect(
      rendered.container.querySelector('[data-project-work-queue-state="not-ready"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain('Work Queue not ready');
    expect(rendered.container.textContent).toContain(
      'No unconfirmed work is shown.',
    );
    expect(rendered.container.querySelector('[data-testid="queue-list"]')).toBeNull();
    const queueOptions = useQueryMock.mock.calls[0]?.[0] as {
      retry: (failureCount: number, error: unknown) => boolean;
    };
    expect(queueOptions.retry(0, notReady)).toBe(false);
    rendered.unmount();
  });

  it('shows cached rows read-only when the latest queue refresh failed', () => {
    useQueryMock
      .mockReturnValueOnce(queryState({
        data: { entries: [{ projectId: 'proj_1' }], generatedAt: '2026-07-29T00:00:00Z' },
        error: new Error('offline'),
      }))
      .mockReturnValueOnce(queryState({ data: [], isSuccess: true }));

    const rendered = renderIntoDocument(<WorkQueueClient />);
    const list = rendered.container.querySelector('[data-testid="queue-list"]');

    expect(
      rendered.container.querySelector('[data-project-work-queue-state="refresh-failed"]'),
    ).not.toBeNull();
    expect(list?.getAttribute('data-entry-count')).toBe('1');
    expect(list?.getAttribute('data-mutations-enabled')).toBe('false');
    expect(list?.getAttribute('data-reassignment-enabled')).toBe('true');
    rendered.unmount();
  });

  it('keeps fresh work actions available but disables reassignment without the staff directory', () => {
    useQueryMock
      .mockReturnValueOnce(queryState({
        data: { entries: [{ projectId: 'proj_1' }], generatedAt: '2026-07-29T00:00:00Z' },
        isSuccess: true,
      }))
      .mockReturnValueOnce(queryState({
        error: new Error('directory unavailable'),
      }));

    const rendered = renderIntoDocument(<WorkQueueClient />);
    const list = rendered.container.querySelector('[data-testid="queue-list"]');

    expect(
      rendered.container.querySelector('[data-project-work-queue-state="fresh"]'),
    ).not.toBeNull();
    expect(list?.getAttribute('data-mutations-enabled')).toBe('true');
    expect(list?.getAttribute('data-reassignment-enabled')).toBe('false');
    expect(rendered.container.textContent).toContain('Staff names unavailable');
    rendered.unmount();
  });
});
