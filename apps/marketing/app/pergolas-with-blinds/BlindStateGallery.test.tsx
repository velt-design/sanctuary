import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import BlindStateGallery from './BlindStateGallery';

it('switches the actual labelled photograph without changing a saved design or issuing a request', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const originalStorage = window.localStorage;
  const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<BlindStateGallery/>));
    const [raised, lowered] = [...host.querySelectorAll<HTMLButtonElement>('button')];
    const visibleImage = () => host.querySelector<HTMLImageElement>('[data-decoded-photo=shown]')!;
    const incomingImage = () => host.querySelector<HTMLImageElement>('[data-decoded-photo=incoming]')!;
    expect(lowered.getAttribute('aria-pressed')).toBe('true');
    expect(visibleImage().alt).toContain('lowered to the sill');
    const original = visibleImage();
    const originalCaption = host.querySelector('figcaption')!.textContent;
    const height = visibleImage().height;
    raised.focus(); await act(async () => raised.click());
    expect(document.activeElement).toBe(raised);
    expect(raised.getAttribute('aria-pressed')).toBe('true');
    expect(lowered.getAttribute('aria-pressed')).toBe('false');
    expect(visibleImage()).toBe(original);
    expect(visibleImage().alt).toContain('lowered to the sill');
    expect(host.querySelector('figcaption')!.textContent).toBe(originalCaption);
    const replacement = incomingImage();
    expect(replacement.getAttribute('aria-hidden')).toBe('true');
    expect(replacement.style.opacity).toBe('0');
    let decoded!: () => void;
    const pendingDecode = new Promise<void>(resolve => { decoded = resolve; });
    Object.defineProperty(replacement, 'decode', { value: () => pendingDecode });
    await act(async () => replacement.dispatchEvent(new Event('load')));
    expect(visibleImage()).toBe(original);
    expect(visibleImage().alt).toContain('lowered to the sill');
    await act(async () => decoded());
    expect(visibleImage().alt).toContain('rolled up');
    expect(visibleImage()).toBe(original);
    expect(incomingImage()).toBeNull();
    expect(visibleImage().height).toBe(height);
    expect(host.querySelector('figcaption')?.textContent).toContain('opening: raised.');
    expect(host.querySelector('figcaption')?.textContent).toContain('slightly different positions');
    await act(async () => lowered.click());
    expect(visibleImage().alt).toContain('rolled up');
    Object.defineProperty(incomingImage(), 'decode', { value: () => Promise.resolve() });
    await act(async () => incomingImage().dispatchEvent(new Event('load')));
    expect(visibleImage().alt).toContain('lowered to the sill');
    expect(host.querySelector('figcaption')?.textContent).toContain('opening: lowered.');
    expect(visibleImage().height).toBe(height);
    expect(fetch).not.toHaveBeenCalled();
    for (const spy of Object.values(storage)) expect(spy).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); host.remove();
    Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true }); vi.unstubAllGlobals();
  }
});
