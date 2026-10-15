import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import FunnelControls from './FunnelControls';
import { productSelectionDraft } from '../products/productSelection';
import { INITIAL_PRODUCT_SELECTION } from '../products/productSelectionValues';
import { previewProjectionMax } from '../configurator-prototype/roofFinish';
import { parsePreviewDraft } from '../configurator-prototype/previewDraft';
import { funnelPriceState } from './FunnelEstimate';
import LandingEstimate from '../../app/pergolas-auckland/LandingEstimate';
import { LANDING_PRICE_CELLS, landingPriceIndex, type LandingPriceTable } from '../../lib/landingPriceTable';

it('shows immediate table prices through the actual acrylic to solid to acrylic controls', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers();
  const amounts = Array(LANDING_PRICE_CELLS).fill(12345) as number[];
  amounts[landingPriceIndex('gable', { ...INITIAL_PRODUCT_SELECTION, material: 'solid' })!] = 23455;
  const table: LandingPriceTable = { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64), versionId: '11111111-1111-4111-8111-111111111111', versionNumber: 1, currency: 'NZD', includesGst: true, amounts };
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ready', table, leaseMs: 30000 }) });
  vi.stubGlobal('fetch', fetcher);
  function Journey() {
    const [draft, setDraft] = useState(() => productSelectionDraft(INITIAL_PRODUCT_SELECTION, 'gable').draft);
    return <><FunnelControls state={{ ...draft, ready: true, setInput: input => setDraft(parsePreviewDraft({ ...draft, input })!), setRoof: roof => setDraft(parsePreviewDraft({ ...draft, roof })!) }} onEdit={() => {}}/><LandingEstimate state={funnelPriceState(draft, true)}/></>;
  }
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(<Journey/>));
    expect(host.textContent).toContain('$12,345');
    await act(async () => host.querySelectorAll<HTMLInputElement>('[name=funnel-material]')[1].click());
    expect(host.textContent).toContain('$23,455');
    expect(host.textContent).not.toContain('Updating estimate');
    await act(async () => host.querySelectorAll<HTMLInputElement>('[name=funnel-material]')[0].click());
    expect(host.textContent).toContain('$12,345');
    expect(host.textContent).not.toContain('Updating estimate');
    expect(fetcher.mock.calls.every(([url]) => url === '/api/landing-price-table')).toBe(true);
  } finally { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it('announces the exact canonical size adjustment when a new roof cannot hold the requested projection', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const draft = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, material: 'solid', projectionMm: 6000 }, 'gable').draft;
  const setRoof = vi.fn();
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(<FunnelControls state={{ ...draft, ready: true, setInput: vi.fn(), setRoof }} onEdit={() => {}}/>));
    await act(async () => host.querySelectorAll<HTMLInputElement>('[name=funnel-shape]')[2].click());
    const next = setRoof.mock.calls[0][0];
    expect(next.family).toBe('box');
    expect(host.querySelector('[role=status]')?.textContent).toContain(`Projection adjusted from 6.0 m to ${(previewProjectionMax(next) / 1000).toFixed(1)} m`);
    expect(host.querySelector('[role=status]')?.textContent).toContain('Review your size before enquiring');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
