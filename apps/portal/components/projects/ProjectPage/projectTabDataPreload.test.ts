import { describe, expect, it, vi } from 'vitest';
import { preloadProjectTabData } from './projectTabDataPreload';
import { qk } from '@/lib/queries/keys';

describe('project tab data preload', () => {
  it('preloads both design metadata and quote versions for Quotes', async () => {
    const prefetchQuery = vi.fn().mockResolvedValue(undefined);

    await preloadProjectTabData('quotes', {
      host: 'host',
      projectId: 'proj_1',
      queryClient: { prefetchQuery } as any,
    });

    expect(prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: qk.estimates.metaByProject('host', 'proj_1') }),
    );
    expect(prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: qk.quotes.versionsByProject('host', 'proj_1') }),
    );
  });

  it('preloads the dedicated command-centre read for Overview', async () => {
    const prefetchQuery = vi.fn();

    await preloadProjectTabData('activity', {
      host: 'host',
      projectId: 'proj_1',
      queryClient: { prefetchQuery } as any,
    });

    expect(prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: qk.projects.commandCentre('host', 'proj_1') }),
    );
  });
});
