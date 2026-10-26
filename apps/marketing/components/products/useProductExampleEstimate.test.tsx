import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChallengerPriceExamples from '../../app/_home-project-finder/ChallengerPriceExamples';
import ProductExamplePrice from './ProductExamplePrice';
import { useProductExampleEstimate } from './useProductExampleEstimate';
import { INITIAL_PRODUCT_SELECTION } from './productSelectionValues';
import { LANDING_PRICE_CELLS, landingPriceIndex } from '../../lib/landingPriceTable';

const table = { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64),
  versionId: '11111111-1111-4111-8111-111111111111', versionNumber: 1,
  currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) };
const response = (body: unknown) => ({ ok: true, json: async () => body });
const ready = { status: 'ready', table, leaseMs: 30000 };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  vi.stubEnv('NODE_ENV', 'production'); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState({}, '', '/');
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  // Separate fixtures are separate documents, rather than a retained route return.
  window.dispatchEvent(new Event('focus'));
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks();
});
async function tick(ms = 0) { await act(async () => vi.advanceTimersByTimeAsync(ms)); }
async function render(show = true) {
  await act(async () => root.render(show ? <>
    <ChallengerPriceExamples type="pitched"/><ChallengerPriceExamples type="gable"/><ChallengerPriceExamples type="box-perimeter"/>
    <ProductExamplePrice type="pitched"/><ProductExamplePrice type="gable"/><ProductExamplePrice type="box-perimeter"/>
  </> : null));
}

it('shares one authorized table across all nine homepage and three product examples, including a warm route return', async () => {
  let accept!: (value: unknown) => void;
  const fetcher = vi.fn<(url: string) => Promise<unknown>>(() => new Promise(resolve => { accept = resolve; })); vi.stubGlobal('fetch', fetcher);
  await render(); await tick(1000);
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(0);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => accept(response(ready)));
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(12);
  expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toBe('/api/landing-price-table');
  await render(false); await tick(1000); await render();
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(12);
  expect(host.textContent).not.toContain('Updating'); expect(fetcher).toHaveBeenCalledTimes(1);
});

it('never shows an expired table during a stalled renewal and ignores that old price after focus', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(ready)).mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetcher); await render(); await tick();
  await tick(30000);
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(0); expect(host.textContent).not.toContain('$12,345');
  await tick(220);
  expect(fetcher.mock.calls.filter(call => call[0] === '/api/configurator-price')).toHaveLength(12);
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(0);
});

it('clears all examples before focus revalidation and replaces the publication together', async () => {
  let accept!: (value: unknown) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(response(ready)).mockImplementationOnce(() => new Promise(resolve => { accept = resolve; }));
  vi.stubGlobal('fetch', fetcher); await render(); await tick();
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(0); expect(host.textContent).not.toContain('$12,345');
  await act(async () => accept(response({ ...ready, table: { ...table, id: 'c'.repeat(64), amounts: table.amounts.map(() => 23455) } })));
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(12); expect(host.textContent).not.toContain('$12,345');
  expect(host.textContent).toContain('$23,455');
});

it('falls back to fresh unleased canonical requests when the table is unavailable, without reusing them after focus', async () => {
  const fetcher = vi.fn((url: string) => Promise.resolve(response(url === '/api/landing-price-table'
    ? { status: 'unavailable' } : { status: 'priced', amountIncGst: 14500, breakdown: [] })));
  vi.stubGlobal('fetch', fetcher); await render(); await tick(220);
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(12);
  await render(false); await render();
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(0);
  await tick(220); expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(12);
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(0);
  await tick(220); expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(12);
  expect(fetcher.mock.calls.filter(call => call[0] === '/api/configurator-price')).toHaveLength(36);
});

it('keeps custom cells authoritative but sends issue cells through canonical retry rather than claiming a tailored quote', async () => {
  const amounts = [...table.amounts];
  amounts[landingPriceIndex('pitched', INITIAL_PRODUCT_SELECTION)!] = 0;
  amounts[landingPriceIndex('gable', INITIAL_PRODUCT_SELECTION)!] = -1;
  const fetcher = vi.fn((url: string) => Promise.resolve(response(url === '/api/landing-price-table'
    ? { ...ready, table: { ...table, amounts } } : { status: 'unavailable' })));
  vi.stubGlobal('fetch', fetcher); await render(); await tick(220);
  expect(host.querySelectorAll('[data-priced=true]')).toHaveLength(8);
  expect(host.querySelectorAll('[data-price-example="6000"]')[0].textContent).toContain('Tailored quote');
  expect(host.querySelectorAll('[data-price-example="6000"]')[1].textContent).toContain('Unavailable');
  expect(host.querySelectorAll('[data-price-example="6000"]')[1].textContent).not.toContain('Tailored quote');
  expect(fetcher.mock.calls.filter(call => call[0] === '/api/configurator-price')).toHaveLength(2);
});

it('keeps alternative orientations and blind selections on their exact canonical path', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ status: 'priced', amountIncGst: 34500, breakdown: [] }));
  vi.stubGlobal('fetch', fetcher);
  function Nonstandard() {
    const { estimate } = useProductExampleEstimate('gable', { ...INITIAL_PRODUCT_SELECTION, orientation: 'away', sides: 'left' });
    return <span>{'amount' in estimate ? estimate.amount : estimate.message}</span>;
  }
  await act(async () => root.render(<Nonstandard/>)); await tick(220);
  expect(host.textContent).toBe('34500'); expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('/api/configurator-price');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ roof: { orientation: 'away', blinds: expect.any(Array) } });
});
