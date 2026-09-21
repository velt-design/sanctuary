import { beforeEach, expect, it, vi } from 'vitest';
import { consumeConfiguratorReturn, prepareConfiguratorReturn, rememberConfiguratorReturn, restoreConfiguratorScroll, safeConfiguratorReturn } from './configuratorReturn';

beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, '', '/products/pergolas/gable?view=roof#design'); });
it('records a seeded entry once, retaining the source URL for a history return', () => {
  const url = new URL('/configurator-preview?open=1&source_path=%2Fproducts%2Fpergolas%2Fgable#design=example', window.location.origin);
  rememberConfiguratorReturn(url);
  window.history.replaceState({}, '', url);
  expect(consumeConfiguratorReturn()?.from).toBe('/products/pergolas/gable?view=roof#design');
  expect(consumeConfiguratorReturn()).toBeNull();
});
it('does not reuse a return for another destination', () => {
  rememberConfiguratorReturn(new URL('/configurator-preview?open=1#design=example', window.location.origin));
  window.history.replaceState({}, '', '/configurator-preview?open=1&source_path=%2F');
  expect(consumeConfiguratorReturn()).toBeNull();
});
it('rejects external, protocol-relative and self-return paths', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/configurator-preview?open=1']) {
    expect(safeConfiguratorReturn(value, window.location.origin)).toBeNull();
  }
});
it('restores the captured position only on the matching source, after route layout', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  prepareConfiguratorReturn({ from: '/products/pergolas/gable?view=roof#design', destination: '/configurator-preview', created: Date.now(), scrollY: 805.5 });
  restoreConfiguratorScroll();
  expect(scroll).not.toHaveBeenCalled();
  frames.shift()!(0); frames.shift()!(1);
  expect(scroll).toHaveBeenCalledWith({ top: 805.5, behavior: 'instant' });
  restoreConfiguratorScroll();
  expect(frames).toHaveLength(0);
  vi.restoreAllMocks();
});
