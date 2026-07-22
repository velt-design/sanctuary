import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { qk } from './keys';
import {
  invalidatePortalSearchQueries,
  normalizePortalSearchQuery,
  PORTAL_SEARCH_DEBOUNCE_MS,
  portalSearchQueryOptions,
} from './portalSearch';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe('portal search query cache', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({
      query: 'alex',
      projects: [],
      contacts: [],
      generatedAt: '2026-07-22T00:00:00.000Z',
    }))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes equivalent queries into one fresh cache entry', async () => {
    const client = createQueryClient();
    expect(PORTAL_SEARCH_DEBOUNCE_MS).toBe(50);
    expect(normalizePortalSearchQuery('  ALEX  ')).toBe('alex');

    await client.fetchQuery(portalSearchQueryOptions('  ALEX  '));
    await client.fetchQuery(portalSearchQueryOptions('alex'));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(qk.search.portal('alex'))).toEqual(expect.objectContaining({ query: 'alex' }));
  });

  it('keeps cached results isolated to their owning QueryClient', async () => {
    const userA = createQueryClient();
    const userB = createQueryClient();

    await userA.fetchQuery(portalSearchQueryOptions('alex'));
    expect(userB.getQueryData(qk.search.portal('alex'))).toBeUndefined();
    await userB.fetchQuery(portalSearchQueryOptions('alex'));

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('invalidates every cached query after searchable records change', async () => {
    const client = createQueryClient();
    await client.fetchQuery(portalSearchQueryOptions('alex'));

    await invalidatePortalSearchQueries(client);

    expect(client.getQueryState(qk.search.portal('alex'))?.isInvalidated).toBe(true);
  });
});
