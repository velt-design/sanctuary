import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/repo/apiClient';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useContactsIndexData } from './useContactsIndexData';

const useQuery = vi.fn();
const params = { search: '', page: 1, pageSize: 50, sort: 'name_asc' } as const;
const cached = {
  contacts: {
    rows: [{ id: 'ct_1', displayName: 'Alex' }],
    totalCount: 1,
    truncated: false,
    page: 1,
    pageSize: 50,
    totalPages: 1,
  },
  query: { search: '', sort: 'name_asc' },
  generatedAt: 'cached',
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: (...args: unknown[]) => useQuery(...args) };
});

function Probe() {
  const result = useContactsIndexData(params);
  return <div data-state={result.state} data-rows={result.data?.contacts.rows.length ?? 0} />;
}

describe('useContactsIndexData', () => {
  beforeEach(() => useQuery.mockReset());
  afterEach(() => { document.body.innerHTML = ''; });

  it('retains the known page after a network or server refresh failure', () => {
    useQuery.mockReturnValue({ data: cached, error: new ApiError('failed', { status: 500, body: {} }), isFetching: false, isPlaceholderData: false, refetch: vi.fn() });
    const rendered = renderIntoDocument(<Probe />);
    expect(rendered.container.firstElementChild?.getAttribute('data-state')).toBe('refresh-failed');
    expect(rendered.container.firstElementChild?.getAttribute('data-rows')).toBe('1');
    rendered.unmount();
  });

  it.each([401, 403])('hides cached data after an access-ending %s response', (status) => {
    useQuery.mockReturnValue({ data: cached, error: new ApiError('denied', { status, body: {} }), isFetching: false, isPlaceholderData: false, refetch: vi.fn() });
    const rendered = renderIntoDocument(<Probe />);
    expect(rendered.container.firstElementChild?.getAttribute('data-state')).toBe('unavailable');
    expect(rendered.container.firstElementChild?.getAttribute('data-rows')).toBe('0');
    rendered.unmount();
  });

  it('distinguishes a retained page refresh from a fresh response', () => {
    useQuery.mockReturnValueOnce({ data: cached, error: null, isFetching: true, isPlaceholderData: true, refetch: vi.fn() });
    const cachedRender = renderIntoDocument(<Probe />);
    expect(cachedRender.container.firstElementChild?.getAttribute('data-state')).toBe('cached');
    cachedRender.unmount();

    useQuery.mockReturnValueOnce({ data: cached, error: null, isFetching: false, isPlaceholderData: false, refetch: vi.fn() });
    const freshRender = renderIntoDocument(<Probe />);
    expect(freshRender.container.firstElementChild?.getAttribute('data-state')).toBe('fresh');
    freshRender.unmount();
  });
});
