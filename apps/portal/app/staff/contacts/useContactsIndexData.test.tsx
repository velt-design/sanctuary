import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/repo/apiClient';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useContactsIndexData } from './useContactsIndexData';

const useQuery = vi.fn();
const placeholderFromCaches = vi.fn();
const seedCanonicalCaches = vi.fn();
const queryClient = {};
const cached = {
  contacts: { rows: [{ id: 'ct_1', displayName: 'Alex' }], totalCount: 1, truncated: false },
  generatedAt: 'cached',
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: (...args: unknown[]) => useQuery(...args), useQueryClient: () => queryClient };
});
vi.mock('@/lib/queries/contactsIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queries/contactsIndex')>();
  return {
    ...actual,
    contactsIndexPlaceholderFromCaches: (...args: unknown[]) => placeholderFromCaches(...args),
    seedContactsIndexCanonicalCaches: (...args: unknown[]) => seedCanonicalCaches(...args),
  };
});

function Probe() {
  const result = useContactsIndexData('host');
  return <div data-state={result.state} data-rows={result.data?.contacts.rows.length ?? 0} />;
}

describe('useContactsIndexData', () => {
  beforeEach(() => {
    useQuery.mockReset();
    placeholderFromCaches.mockReset();
    seedCanonicalCaches.mockReset();
    placeholderFromCaches.mockReturnValue(cached);
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('retains known data after a network or server refresh failure', () => {
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

  it('distinguishes cached refresh from fresh background completion', () => {
    useQuery.mockReturnValueOnce({ data: cached, error: null, isFetching: true, isPlaceholderData: true, refetch: vi.fn() });
    const cachedRender = renderIntoDocument(<Probe />);
    expect(cachedRender.container.firstElementChild?.getAttribute('data-state')).toBe('cached');
    cachedRender.unmount();

    useQuery.mockReturnValueOnce({ data: cached, error: null, isFetching: false, isPlaceholderData: false, refetch: vi.fn() });
    const freshRender = renderIntoDocument(<Probe />);
    expect(freshRender.container.firstElementChild?.getAttribute('data-state')).toBe('fresh');
    expect(seedCanonicalCaches).toHaveBeenCalledWith(queryClient, 'host', cached);
    freshRender.unmount();
  });
});
