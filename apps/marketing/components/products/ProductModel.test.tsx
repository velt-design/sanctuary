import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ProductModel from './ProductModel';
import { INITIAL_PRODUCT_SELECTION, productSelectionDraft } from './productSelection';

vi.mock('../configurator-prototype/PreviewViews', () => ({
  default: ({ input, roof }: { input: { widthMm: number }; roof: { orientation: string } }) =>
    <div data-model-width={input.widthMm} data-model-direction={roof.orientation}>Selected model</div>,
}));
vi.mock('../configurator-prototype/PergolaFootprint', () => ({ default: () => <div data-plan>Selected plan</div> }));

it('recovers the chosen design on mobile entry, retains desktop views during edits, and cleans up its listener', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: false,
    addEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let draft = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, orientation: 'away' }, 'gable').draft;
  const render = () => React.act(async () => root.render(<ProductModel draft={draft} example={{ src: '/example.webp', alt: 'Built reference', caption: 'Built reference' }} />));
  const clickView = (name: string) => React.act(async () => [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Model view"] button')].find(button => button.textContent === name)!.click());
  const resize = (matches: boolean) => React.act(async () => {
    media.matches = matches;
    for (const listener of [...listeners]) listener({ matches } as MediaQueryListEvent);
  });
  try {
    await render();
    const model = host.querySelector('[data-model-width]');
    await clickView('Built example');
    expect(host.querySelector('dialog')?.hidden).toBe(true);
    draft = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, widthMm: 7400, orientation: 'away' }, 'gable').draft;
    await render();
    expect(host.querySelector('dialog')?.hidden).toBe(true);
    await resize(true);
    expect(host.querySelector('dialog')?.hidden).toBe(false);
    expect(host.querySelector('figure')).toBeNull();
    expect(host.querySelector('[data-model-width]')).toBe(model);
    expect(model?.getAttribute('data-model-width')).toBe('7400');
    expect(model?.getAttribute('data-model-direction')).toBe('away');
    expect(host.querySelector('[aria-label="Open fullscreen 3D"]')).not.toBeNull();
    await resize(false);
    await clickView('Plan');
    await render();
    expect(host.querySelector('[data-plan]')).not.toBeNull();
    await resize(true);
    expect(host.querySelector('[data-plan]')).toBeNull();
    expect(host.querySelector('[data-model-width="7400"]')).not.toBeNull();
    await resize(false);
    await clickView('Built example');
    expect(host.querySelector('dialog')?.hidden).toBe(true);
    await clickView('Your design');
    expect(host.querySelector('dialog')?.hidden).toBe(false);
    expect(listeners.size).toBe(1);
  } finally {
    await React.act(async () => root.unmount());
    expect(listeners.size).toBe(0);
    host.remove(); vi.unstubAllGlobals();
  }
});
