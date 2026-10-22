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

it('captures and restores BODY scrolling even when the window remains at zero', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const bodyScroll = vi.fn();
  const oldScroll = document.body.scrollTo;
  document.body.scrollTo = bodyScroll;
  document.body.style.overflowY = 'auto';
  Object.defineProperty(document.body, 'scrollHeight', { configurable: true, value: 3000 });
  Object.defineProperty(document.body, 'clientHeight', { configurable: true, value: 720 });
  document.body.scrollTop = 1280.5;
  try {
    const url = new URL('/configurator-preview?open=1#design=example', window.location.origin);
    rememberConfiguratorReturn(url);
    window.history.replaceState({}, '', url);
    const entry = consumeConfiguratorReturn()!;
    expect(entry.scrollY).toBe(1280.5);
    prepareConfiguratorReturn(entry);
    window.history.replaceState({}, '', entry.from);
    document.body.scrollTop = 0;
    restoreConfiguratorScroll();
    frames.shift()!(0); frames.shift()!(1);
    expect(bodyScroll).toHaveBeenCalledWith({ top: 1280.5, behavior: 'instant' });
    expect(windowScroll).not.toHaveBeenCalled();
  } finally {
    document.body.scrollTop = 0;
    document.body.style.removeProperty('overflow-y');
    Reflect.deleteProperty(document.body, 'scrollHeight');
    Reflect.deleteProperty(document.body, 'clientHeight');
    document.body.scrollTo = oldScroll;
    vi.restoreAllMocks();
  }
});

it('waits for settled source options before restoring, including an unavailable-options layout', async () => {
  const section = document.createElement('section');
  section.dataset.configuratorReturnReady = 'false'; document.body.append(section);
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  prepareConfiguratorReturn({ from: '/products/pergolas/gable?view=roof#design', destination: '/configurator-preview', created: Date.now(), scrollY: 805.5 });
  const cleanup = restoreConfiguratorScroll();
  try {
    expect(frames).toHaveLength(0);
    // Hydration and pending options must not consume the saved position early.
    section.textContent = 'Restoring your design'; await Promise.resolve();
    expect(scroll).not.toHaveBeenCalled();
    section.textContent = 'Options unavailable. Retry options';
    section.dataset.configuratorReturnReady = 'true'; await Promise.resolve();
    expect(frames).toHaveLength(1);
    frames.shift()!(0); frames.shift()!(1);
    expect(scroll).toHaveBeenCalledWith({ top: 805.5, behavior: 'instant' });
    expect(sessionStorage.getItem('sanctuary.configurator-scroll.v1')).toBeNull();
  } finally { cleanup?.(); section.remove(); vi.restoreAllMocks(); }
});

it('abandons a pending restore when the person starts scrolling', async () => {
  const section = document.createElement('section');
  section.dataset.configuratorReturnReady = 'false'; document.body.append(section);
  const frame = vi.spyOn(window, 'requestAnimationFrame');
  prepareConfiguratorReturn({ from: '/products/pergolas/gable?view=roof#design', destination: '/configurator-preview', created: Date.now(), scrollY: 805.5 });
  const cleanup = restoreConfiguratorScroll();
  try {
    window.dispatchEvent(new Event('wheel'));
    section.dataset.configuratorReturnReady = 'true'; await Promise.resolve();
    expect(frame).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('sanctuary.configurator-scroll.v1')).toBeNull();
  } finally { cleanup?.(); section.remove(); vi.restoreAllMocks(); }
});
