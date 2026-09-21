import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useFootprintScale } from './useFootprintScale';

it('holds zoom during a gesture, calmly refits on release, and interrupts without a jump', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { callback = undefined; });
  const host = document.createElement('div'), root = createRoot(host);
  function Harness({ target, moving }: { target: number; moving: boolean }) {
    return <output>{useFootprintScale(target, moving)}</output>;
  }
  const render = (target: number, moving: boolean) => React.act(async () => root.render(<Harness target={target} moving={moving}/>));
  const frame = (time: number) => React.act(async () => { const next = callback; callback = undefined; next?.(time); });
  const value = () => Number(host.textContent);
  try {
    await render(1, false);
    await render(.25, true);
    expect(value()).toBe(1);
    expect(callback).toBeUndefined();
    await render(.25, false);
    await frame(0); await frame(325);
    expect(value()).toBeCloseTo(.5);
    await render(2, true);
    expect(value()).toBeCloseTo(.5);
    expect(callback).toBeUndefined();
    await render(2, false);
    await frame(400); await frame(1050);
    expect(value()).toBe(2);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    await render(.75, false);
    expect(value()).toBe(.75);
    expect(callback).toBeUndefined();
  } finally { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
