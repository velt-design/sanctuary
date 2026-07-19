import { describe, expect, it, vi } from 'vitest';
import { projectDetailHref, preloadProjectOpen } from './projectOpenPreload';
import { qk } from './keys';

describe('project open preload', () => {
  it('preloads the route and the authenticated snapshot query', async () => {
    const prefetch = vi.fn();
    const prefetchQuery = vi.fn().mockResolvedValue(undefined);

    await preloadProjectOpen(
      { prefetchQuery } as any,
      { prefetch },
      'staging-host',
      'proj_123',
    );

    expect(prefetch).toHaveBeenCalledWith('/staff/projects/proj_123');
    expect(prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: qk.projects.snapshot('staging-host', 'proj_123') }),
    );
  });

  it('encodes project ids before building the route', () => {
    expect(projectDetailHref('proj_1/unsafe')).toBe('/staff/projects/proj_1%2Funsafe');
  });
});
