import { expect, it, vi } from 'vitest';
import { lockPageScroll } from './pageScrollLock';

it('locks both roots against important mobile CSS, survives nesting, and restores styles and position', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(240);
  document.body.style.setProperty('position', 'relative');
  document.documentElement.style.setProperty('overflow', 'auto', 'important');
  const setStyle = vi.spyOn(document.documentElement.style, 'setProperty');
  const first = lockPageScroll();
  const second = lockPageScroll();
  expect(document.body.style.position).toBe('fixed');
  expect(document.body.style.top).toBe('-240px');
  // jsdom's cssstyle version drops priorities; verify the write contract here
  // and the computed browser lock in the real journey check.
  expect(setStyle).toHaveBeenCalledWith('overflow', 'hidden', 'important');
  first(); first();
  expect(document.body.style.position).toBe('fixed');
  second();
  expect(document.body.style.position).toBe('relative');
  expect(document.documentElement.style.overflow).toBe('auto');
  expect(scroll).toHaveBeenCalledWith({ left: 0, top: 240, behavior: 'instant' });
  document.body.removeAttribute('style'); document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
});
