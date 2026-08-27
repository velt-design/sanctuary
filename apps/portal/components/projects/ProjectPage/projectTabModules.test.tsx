import { describe, expect, it, vi } from 'vitest';
import { preloadNestedProjectTab } from './projectTabModules';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

describe('project tab module preload', () => {
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
