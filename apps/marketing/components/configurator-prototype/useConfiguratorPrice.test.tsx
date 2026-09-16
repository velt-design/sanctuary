import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useConfiguratorPrice } from './useConfiguratorPrice';
import type { PreviewDraft } from './previewDraft.types';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('hides a previous price immediately and ignores late replies for an edited design', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const replies: Array<(value: unknown) => void> = [];
  const fetchMock = vi.fn(() => new Promise(resolve => replies.push(resolve)));
  vi.stubGlobal('fetch', fetchMock);
  const container = document.createElement('div'), root = createRoot(container);
  const draft: PreviewDraft = { version: 1, input: { widthMm: 5000, projectionMm: 3000, level: 'ground', connection: 'facade' }, roof: { family: 'mono', orientation: 'parallel', infills: false } };
  function Harness({ width }: { width: number }) {
    const { price } = useConfiguratorPrice({ ...draft, input: { ...draft.input, widthMm: width } }, true);
    return <span>{price?.status ?? 'pending'}</span>;
  }
  const render = async (width: number) => { await React.act(async () => root.render(<Harness width={width} />)); };
  const tick = async () => { await React.act(async () => vi.advanceTimersByTimeAsync(220)); };
  const reply = async (index: number, status: string) => {
    await React.act(async () => replies[index]({ json: async () => ({ status }) }));
  };
  try {
    await render(5000); await tick(); await reply(0, 'priced');
    expect(container.textContent).toBe('priced');
    await render(6000);
    expect(container.textContent).toBe('pending');
    await tick();
    await render(7000); await tick();
    expect(fetchMock.mock.calls).toHaveLength(3);
    await reply(2, 'custom');
    await reply(1, 'priced');
    expect(container.textContent).toBe('custom');
  } finally { await React.act(async () => root.unmount()); }
});
