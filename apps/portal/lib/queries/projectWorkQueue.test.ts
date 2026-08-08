import { describe, expect, it, vi } from 'vitest';
import {
  preloadProjectWorkQueue,
  PROJECT_WORK_QUEUE_HREF,
  projectWorkQueueQueryOptions,
} from './projectWorkQueue';

describe('project Work Queue query', () => {
  it('preloads the route and current-user memory query together', () => {
    const prefetch = vi.fn();
    const prefetchQuery = vi.fn().mockResolvedValue(undefined);

    preloadProjectWorkQueue(
      { prefetchQuery } as never,
      { prefetch },
      'portal.test',
    );

    expect(prefetch).toHaveBeenCalledWith(PROJECT_WORK_QUEUE_HREF);
    expect(prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: projectWorkQueueQueryOptions('portal.test').queryKey,
      staleTime: 5_000,
    }));
  });

  it('keeps prefetched data fresh briefly and browser-memory bounded', () => {
    const options = projectWorkQueueQueryOptions('portal.test');

    expect(options.staleTime).toBe(5_000);
    expect(options.gcTime).toBe(24 * 60 * 60 * 1_000);
    expect(options.refetchOnMount).toBeUndefined();
  });
});
