import { beforeEach, expect, it, vi } from 'vitest';

const evaluated = vi.hoisted(() => ({ editor: vi.fn(), canvas: vi.fn(), canvasImport: vi.fn(), saved: vi.fn(), website: vi.fn(), dynamic: vi.fn() }));
vi.mock('next/dynamic', () => ({ default: (loader: unknown, options: unknown) => { evaluated.dynamic(loader, options); return () => null; } }));
vi.mock('./StudioEditor', () => { evaluated.editor(); return { default: () => null }; });
vi.mock('./StudioHouseCanvas', async () => { evaluated.canvas(); await evaluated.canvasImport(); return { default: () => null }; });
vi.mock('./SavedStudioReview', () => { evaluated.saved(); return { default: () => null }; });
vi.mock('./StudioWebsiteReview', () => { evaluated.website(); return { default: () => null }; });
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); evaluated.canvasImport.mockResolvedValue(undefined);
  vi.doMock('./StudioHouseCanvas', async () => { evaluated.canvas(); await evaluated.canvasImport(); return { default: () => null }; });
});

it('does not evaluate a leaf until requested and returns the exact existing component', async () => {
  const loaders = await import('./studioLeafLoading');
  expect(evaluated.editor).not.toHaveBeenCalled();
  expect(evaluated.canvas).not.toHaveBeenCalled();
  expect(evaluated.saved).not.toHaveBeenCalled();
  expect(evaluated.website).not.toHaveBeenCalled();
  const Editor = await loaders.loadStudioEditor();
  expect(Editor).toBe((await import('./StudioEditor')).default);
  expect(evaluated.editor).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  await vi.waitFor(() => expect(evaluated.canvas).toHaveBeenCalledTimes(1));
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

it('uses the identical Canvas module importer for public preload and the actual Workspace render boundary', async () => {
  let release!: () => void;
  evaluated.canvasImport.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  const loaders = await import('./studioLeafLoading');
  await import('./StudioHouseWorkspace');
  expect(loaders.loadStudioHouseCanvasModule).toBeTypeOf('function');
  expect(evaluated.dynamic.mock.calls.some(([loader, options]) => loader === loaders.loadStudioHouseCanvasModule && options.ssr === false)).toBe(true);
  expect(evaluated.canvas).not.toHaveBeenCalled();
  const Editor = await loaders.loadStudioEditor();
  expect(Editor).toBe((await import('./StudioEditor')).default);
  const renderModule = loaders.loadStudioHouseCanvasModule();
  let completed = false;
  void renderModule.then(() => { completed = true; });
  await Promise.resolve();
  expect(completed).toBe(false);
  expect(evaluated.canvas).toHaveBeenCalledTimes(1);
  release();
  expect((await renderModule).default).toBe((await import('./StudioHouseCanvas')).default);
  expect(evaluated.canvas).toHaveBeenCalledTimes(1);
  expect(evaluated.saved).not.toHaveBeenCalled();
  expect(evaluated.website).not.toHaveBeenCalled();
});

it.each(['pending', 'failed'])('does not make editor availability depend on a %s optional canvas preload', async state => {
  let release!: () => void;
  if (state === 'pending') evaluated.canvasImport.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  else evaluated.canvasImport.mockRejectedValue(Error('Canvas chunk unavailable'));
  const loaders = await import('./studioLeafLoading');
  const Editor = await loaders.loadStudioEditor();
  expect(Editor).toBe((await import('./StudioEditor')).default);
  expect(evaluated.canvas).toHaveBeenCalledTimes(1);
  expect(evaluated.saved).not.toHaveBeenCalled();
  expect(evaluated.website).not.toHaveBeenCalled();
  if (state === 'pending') release();
  else await expect(loaders.loadStudioHouseCanvasModule()).rejects.toMatchObject({ cause: { message: 'Canvas chunk unavailable' } });
  await Promise.resolve();
});
