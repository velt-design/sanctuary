import { describe, expect, it, vi } from 'vitest';
import { preloadNestedProjectTab } from './projectTabModules';

const { dynamicMock } = vi.hoisted(() => ({
  dynamicMock: vi.fn((
    _loader: unknown,
    _options?: { loading?: () => { props: Record<string, unknown> } },
  ) => () => null),
}));

vi.mock('next/dynamic', () => ({
  default: dynamicMock,
}));

describe('project tab module preload', () => {
  it('labels the shared lazy shell as Commercial rather than a nested route', () => {
    const labels = dynamicMock.mock.calls.map(call => call[1]?.loading?.().props['data-project-tab-loading']);
    expect(labels).toEqual(['activity', 'files', 'commercial', 'job-packs']);
  });

  it('preloads the nested Estimates module for Commercial intent', async () => {
    const preloadCommercialView = vi.fn().mockResolvedValue(undefined);

    await preloadNestedProjectTab('estimates', preloadCommercialView);

    expect(preloadCommercialView).toHaveBeenCalledWith('estimates');
  });

  it('does not request a Commercial subview for another project tab', async () => {
    const preloadCommercialView = vi.fn().mockResolvedValue(undefined);

    await preloadNestedProjectTab('activity', preloadCommercialView);

    expect(preloadCommercialView).not.toHaveBeenCalled();
  });
});
