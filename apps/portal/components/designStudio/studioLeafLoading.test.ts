import { beforeEach, expect, it, vi } from 'vitest';

const evaluated = vi.hoisted(() => ({ editor: vi.fn(), saved: vi.fn(), website: vi.fn() }));
vi.mock('./StudioEditor', () => { evaluated.editor(); return { default: () => null }; });
vi.mock('./SavedStudioReview', () => { evaluated.saved(); return { default: () => null }; });
vi.mock('./StudioWebsiteReview', () => { evaluated.website(); return { default: () => null }; });
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

it('does not evaluate a leaf until requested and returns the exact existing component', async () => {
  const loaders = await import('./studioLeafLoading');
  expect(evaluated.editor).not.toHaveBeenCalled();
  expect(evaluated.saved).not.toHaveBeenCalled();
  expect(evaluated.website).not.toHaveBeenCalled();
  const Editor = await loaders.loadStudioEditor();
  expect(Editor).toBe((await import('./StudioEditor')).default);
  expect(evaluated.editor).toHaveBeenCalledTimes(1);
  expect(evaluated.saved).not.toHaveBeenCalled();
  expect(evaluated.website).not.toHaveBeenCalled();
});

it('shares pending work, retries rejection, and preserves successful identity', async () => {
  const { createStudioLeafLoader } = await import('./studioLeafLoading');
  const Component = () => null;
  const importer = vi.fn().mockRejectedValueOnce(Error('Chunk unavailable')).mockResolvedValue({ default: Component });
  const load = createStudioLeafLoader(importer);
  const first = load();
  expect(load()).toBe(first);
  expect(await first).toBeNull();
  expect(await load()).toBe(Component);
  expect(await load()).toBe(Component);
  expect(importer).toHaveBeenCalledTimes(2);
});
