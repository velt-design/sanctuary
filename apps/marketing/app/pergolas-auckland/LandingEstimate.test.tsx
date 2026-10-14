import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LandingEstimate from './LandingEstimate';
import type { LandingSelectionState } from './useLandingPrice';
import { INITIAL_PRODUCT_SELECTION } from '../../components/products/productSelectionValues';
import { LANDING_PRICE_CELLS, landingPriceIndex, type LandingPriceTable } from '../../lib/landingPriceTable';

const table: LandingPriceTable = { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64), versionId: '11111111-1111-4111-8111-111111111111',
  versionNumber: 1, currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) as number[] };
const reply = (body: unknown) => ({ ok: true, json: async () => body });
const ready = { status: 'ready', table, leaseMs: 30000 };
function selection(): LandingSelectionState {
  return { type: 'pitched', selection: INITIAL_PRODUCT_SELECTION, update: vi.fn(), ready: true, storageAvailable: true, otherDraft: false,
    recovery: '', design: null, failed: false, resume: false, explore: vi.fn(), continueDesign: vi.fn(), retry: vi.fn() };
}
function withDesign(): LandingSelectionState {
  return { ...selection(), design: { draft: { version: 1, input: { widthMm: 6000, projectionMm: 3000, level: 'ground', connection: 'fascia' },
    roof: { family: 'mono', orientation: 'parallel', infills: false } }, issue: null, projectionMax: 6000, restored: false,
    summary: [], enquiryHref: '/design-enquiry', designerHref: '/configurator-preview' } };
}
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); root = createRoot(container); });
afterEach(async () => { await React.act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function render(state: LandingSelectionState) { await React.act(async () => root.render(<LandingEstimate state={state} />)); }
async function tick(ms: number) { await React.act(async () => vi.advanceTimersByTimeAsync(ms)); }

it('prices unseen current inputs and unsupported/custom cells synchronously without a prepared design or ordinary price request', async () => {
  const state = selection(), next = { ...state, type: 'gable' as const, selection: { ...state.selection, widthMm: 5300, material: 'combination' as const } };
  const amounts = [...table.amounts]; amounts[landingPriceIndex(next.type, next.selection)!] = 23455;
  const fetcher = vi.fn().mockResolvedValue(reply({ ...ready, table: { ...table, amounts } })); vi.stubGlobal('fetch', fetcher);
  await render(state); expect(container.textContent).toContain('$12,345');
  await render(next); expect(container.textContent).toContain('$23,455'); expect(container.textContent).not.toMatch(/Updating|Preparing/);
  const custom = { ...next, selection: { ...next.selection, widthMm: 10000, projectionMm: 6000 } };
  amounts[landingPriceIndex(custom.type, custom.selection)!] = 0;
  await render(custom); expect(container.textContent).toContain('Tailored quote');
  amounts[landingPriceIndex(custom.type, custom.selection)!] = -1;
  await render({ ...custom }); expect(container.textContent).toContain('Check the projection');
  expect(fetcher.mock.calls.every(([url]) => url === '/api/landing-price-table')).toBe(true);
});

it('keeps preparation retry usable alongside a valid table price', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(ready))); const state = { ...selection(), failed: true };
  await render(state); expect(container.textContent).toContain('$12,345');
  await React.act(async () => container.querySelector('button')!.click()); expect(state.retry).toHaveBeenCalledOnce();
});

it('never uses a basic table price for saved designer extras, even when visible controls match', async () => {
  const fetcher = vi.fn((url: string) => Promise.resolve(reply(url === '/api/landing-price-table' ? ready : { status: 'priced', amountIncGst: 99995 })));
  vi.stubGlobal('fetch', fetcher); const state = withDesign(); state.resume = true; state.design!.restored = true; state.design!.draft.roof.infills = true;
  await render(state); expect(container.textContent).not.toContain('$12,345'); await tick(220);
  expect(container.textContent).toContain('$99,995');
  const request = fetcher.mock.calls.find(([url]) => url === '/api/configurator-price')!;
  expect(JSON.parse((request as unknown as [string, RequestInit])[1].body as string).roof.infills).toBe(true);
});

it('does not reveal an earlier canonical reply after table revocation, and starts a fresh fallback', async () => {
  let tableReply!: (value: unknown) => void; let canonicalCalls = 0; let tableCalls = 0;
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/landing-price-table') return ++tableCalls === 1 ? new Promise(resolve => { tableReply = resolve; }) : Promise.resolve(reply({ status: 'unavailable' }));
    canonicalCalls++; return Promise.resolve(reply({ status: 'priced', amountIncGst: canonicalCalls === 1 ? 5000 : 15000 }));
  }));
  await render(withDesign()); await tick(220); expect(container.textContent).toContain('$5,000');
  await React.act(async () => tableReply(reply(ready))); expect(container.textContent).toContain('$12,345');
  await tick(14780); expect(container.textContent).toContain('Updating estimate'); expect(container.textContent).not.toContain('$5,000');
  await tick(220); expect(canonicalCalls).toBe(2); expect(container.textContent).toContain('$15,000');
});
