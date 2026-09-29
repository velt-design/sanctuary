import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ProductModel from './ProductModel';
import { INITIAL_PRODUCT_SELECTION, productSelectionDraft } from './productSelection';

vi.mock('../configurator-prototype/PreviewViews', () => ({
  default: ({ input, roof, onViewChange }: { input: { widthMm: number }; roof: { orientation: string }; onViewChange: (view: 'Plan') => void }) =>
    <div data-model-width={input.widthMm} data-model-direction={roof.orientation}>Selected model<button data-gpu-failure onClick={() => onViewChange('Plan')}>Simulate GPU failure</button></div>,
}));
vi.mock('../configurator-prototype/PergolaFootprint', () => ({ default: () => <div data-plan>Selected plan</div> }));

it('retains photo and plan views across responsive changes and keeps current design edits', async () => {
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
  let mode: 'Photos' | 'Design' | 'Plan' = 'Photos';
  const changeMode = (next: typeof mode) => { mode = next; void render(); };
  const render = () => React.act(async () => root.render(<ProductModel draft={draft} gallery={[{ src: '/example.webp', alt: 'Built reference', caption: 'Built reference' }]} mode={mode} onModeChange={changeMode} />));
  const clickView = (name: string) => React.act(async () => [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Model view"] button')].find(button => button.textContent === name)!.click());
  const resize = (matches: boolean) => React.act(async () => {
    media.matches = matches;
    for (const listener of [...listeners]) listener({ matches } as MediaQueryListEvent);
  });
  try {
    await render();
    expect(host.querySelector('[data-model-width]')).toBeNull();
    await clickView('Photos');
    expect(host.querySelector('dialog')?.hidden).toBe(true);
    draft = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, widthMm: 7400, orientation: 'away' }, 'gable').draft;
    await render();
    expect(host.querySelector('dialog')?.hidden).toBe(true);
    await resize(true);
    expect(host.querySelector('dialog')?.hidden).toBe(true);
    expect(host.querySelector('figure')).not.toBeNull();
    expect(host.querySelector('[data-model-width]')).toBeNull();
    expect(host.querySelector('[aria-label="Open fullscreen 3D"]')).not.toBeNull();
    await resize(false);
    await clickView('Plan');
    await render();
    expect(host.querySelector('[data-plan]')).not.toBeNull();
    expect(host.querySelector('[data-model-width]')).toBeNull();
    await resize(true);
    expect(host.querySelector('[data-plan]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Open fullscreen 3D"]')).toBeNull();
    await resize(false);
    await clickView('Photos');
    expect(host.querySelector('dialog')?.hidden).toBe(true);
    await clickView('Design');
    expect(host.querySelector('dialog')?.hidden).toBe(false);
    const model = host.querySelector('[data-model-width]');
    expect(model?.getAttribute('data-model-width')).toBe('7400');
    expect(model?.getAttribute('data-model-direction')).toBe('away');
    await clickView('Photos');
    expect(host.querySelector('[data-model-width]')).toBe(model);
    await clickView('Plan');
    expect(host.querySelector('[data-model-width]')).toBe(model);
    await clickView('Design');
    expect(host.querySelector('[data-model-width]')).toBe(model);
    await React.act(async () => host.querySelector<HTMLButtonElement>('[data-gpu-failure]')!.click());
    expect(mode).toBe('Plan');
    expect(host.querySelector('[data-model-width]')).toBeNull();
    expect(host.querySelector('[data-plan]')).not.toBeNull();
    await clickView('Design');
    expect(host.querySelector('[data-model-width]')).not.toBeNull();
    expect(host.querySelector('[data-model-width]')).not.toBe(model);
    expect(listeners.size).toBe(0);
  } finally {
    await React.act(async () => root.unmount());
    expect(listeners.size).toBe(0);
    host.remove(); vi.unstubAllGlobals();
  }
});
