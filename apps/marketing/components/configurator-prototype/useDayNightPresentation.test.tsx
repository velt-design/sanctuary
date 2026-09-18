import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useDayNightPresentation, type NightPresentation } from './useDayNightPresentation';

it('keeps snapshot lighting local without clearing the surrounding palette on removal', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const host = document.createElement('div');
  host.setAttribute('data-night', 'true');
  host.style.setProperty('--night-amount', '1');
  document.body.append(host);
  const root = createRoot(host);
  function Portrait() {
    const viewport = React.useRef<HTMLDivElement>(null);
    useDayNightPresentation(false, viewport, true);
    return <div ref={viewport} />;
  }
  try {
    await React.act(async () => root.render(<Portrait />));
    expect((host.firstElementChild as HTMLElement).style.getPropertyValue('--night-amount')).toBe('0');
    expect(host.style.getPropertyValue('--night-amount')).toBe('1');
    await React.act(async () => root.unmount());
    expect(host.style.getPropertyValue('--night-amount')).toBe('1');
  } finally { host.remove(); vi.unstubAllGlobals(); }
});

it('owns a reversible palette before the renderer mounts and across renderer removal', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let now = 0, next = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => preference);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  let store: NightPresentation;
  const observed: number[] = [];
  function Renderer({ presentation }: { presentation: NightPresentation }) {
    React.useLayoutEffect(() => {
      const frame = () => observed.push(presentation.current);
      presentation.listeners.add(frame); frame();
      return () => { presentation.listeners.delete(frame); };
    }, [presentation]);
    return <canvas />;
  }
  function View({night, renderer}: {night: boolean; renderer: boolean}) {
    const viewport = React.useRef<HTMLDivElement>(null);
    store = useDayNightPresentation(night, viewport);
    return <div ref={viewport} data-view="3D">{renderer && <Renderer presentation={store}/>}</div>;
  }
  async function render(night: boolean, renderer: boolean) {
    await React.act(async () => root.render(<dialog><div data-night={night}><View night={night} renderer={renderer}/></div></dialog>));
  }
  async function tick(time: number) {
    now = time;
    await React.act(async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); });
  }
  const amount = () => Number((host.querySelector('[data-view]') as HTMLElement).style.getPropertyValue('--night-amount'));
  try {
    await render(false, false);
    await render(true, false); await tick(500);
    expect(amount()).toBe(.5);
    expect(host.querySelector('canvas')).toBeNull();
    await render(true, true);
    expect(observed.at(-1)).toBe(.5);
    await render(true, false); await tick(1000);
    expect(amount()).toBe(1);
    expect((host.querySelector('[data-night]') as HTMLElement).style.getPropertyValue('--night-amount')).toBe('1');
    await render(false, false); await tick(1500);
    expect(amount()).toBe(.5);
    await render(true, false); await tick(1750);
    expect(amount()).toBeGreaterThan(.5);
    preference.matches = true;
    await React.act(async () => preference.addEventListener.mock.calls.at(-1)![1]());
    expect(amount()).toBe(1);
    await render(true, true);
    expect(observed.at(-1)).toBe(1);
    expect(store!.listeners.size).toBe(1);
  } finally {
    await React.act(async () => root.unmount());
    expect(frames.size).toBe(0);
    host.remove(); clock.mockRestore(); vi.unstubAllGlobals();
  }
});

