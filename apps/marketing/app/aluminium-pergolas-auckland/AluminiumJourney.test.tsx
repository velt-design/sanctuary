// @vitest-environment-options {"url":"https://www.sanctuarypergolas.co.nz/"}
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import AluminiumJourney from './AluminiumJourney';
import { LANDING_DRAFT_KEY, withLandingDesignScope } from '../../components/configurator-prototype/draftScope';
import { usePreviewDraft } from '../../components/configurator-prototype/usePreviewDraft';
import { PREVIEW_DRAFT_KEY } from '../../components/configurator-prototype/previewDraft';
import { LANDING_PRICE_CELLS, landingPriceIndex } from '../../lib/landingPriceTable';
import { INITIAL_PRODUCT_SELECTION } from '../../components/products/productSelectionValues';
import { CONFIGURATOR_PRICE_LEASE_HEADER, CONFIGURATOR_PRICE_PUBLICATION_HEADER } from '../../lib/configuratorPriceLease';
import { designEnquiryHref, isConfiguratorEntry } from '../../components/configurator-prototype/configuratorOverlay';

vi.mock('../../components/ConsentProvider', () => ({ useConsent: () => ({ consent: { analytics: true, marketing: false }, hasTrackingDecision: true, trackingBasis: 'user_choice', trackingRegionPolicy: 'strict' }) }));

it('keeps direct enquiry design-free, then retains selected extras, price and details through designer return, retry and reload', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); localStorage.clear();
  window.history.replaceState({}, '', '/aluminium-pergolas-auckland');
  const originalDraft = 'unrelated existing product draft';
  sessionStorage.setItem(PREVIEW_DRAFT_KEY, originalDraft);
  const amounts = Array(LANDING_PRICE_CELLS).fill(12345) as number[];
  amounts[landingPriceIndex('gable', { ...INITIAL_PRODUCT_SELECTION, widthMm: 5400 })!] = 14445;
  const events = vi.fn(); vi.stubGlobal('gtag', events);
  const submissions: Record<string, unknown>[] = [];
  let accept = false;
  const network = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/landing-price-table') return { ok: true, json: async () => ({ status: 'ready', leaseMs: 30000, table: { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64), versionId: '11111111-1111-4111-8111-111111111111', versionNumber: 1, currency: 'NZD', includesGst: true, amounts } }) };
    if (url === '/api/configurator-price') {
      const draft = JSON.parse(String(options?.body));
      return { ok: true, headers: new Headers({ [CONFIGURATOR_PRICE_LEASE_HEADER]: '30000', [CONFIGURATOR_PRICE_PUBLICATION_HEADER]: 'b'.repeat(64) }), json: async () => ({ status: 'priced', amountIncGst: draft.roof.infills ? 16665 : 14445, calculationRef: 'cf1.fixture', currency: 'NZD', includesGst: true }) };
    }
    if (url === '/api/enquiry') { submissions.push(JSON.parse(String(options?.body))); return { ok: accept, status: accept ? 200 : 503, json: async () => accept ? { ok: true } : { error: 'Please retry your enquiry.' } }; }
    throw new Error(`Unexpected network: ${url}`);
  });
  vi.stubGlobal('fetch', network);
  const host = document.createElement('div'); document.body.append(host); let root = createRoot(host);
  let designer: ReturnType<typeof usePreviewDraft>;
  function Designer() { designer = usePreviewDraft(); return null; }
  const mount = () => act(async () => root.render(<AluminiumJourney><p>Material story</p></AluminiumJourney>));
  const submit = () => act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const fill = async () => act(async () => {
    for (const [name, value] of Object.entries({ name: 'Synthetic Customer', email: 'fixture@example.invalid', suburb: 'Albany' })) {
      const input = host.querySelector<HTMLInputElement>(`[name=${name}]`)!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  try {
    await mount();
    expect(host.textContent).toContain('$12,345');
    expect(host.textContent).not.toContain('Your selected design is included');
    expect(events).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLInputElement>('[name=phone]')!.required).toBe(false);
    await fill(); await submit();
    expect(submissions[0]).not.toHaveProperty('customerDesign');
    expect(host.textContent).toContain('Please retry your enquiry.');
    expect(host.querySelector('[role=alert]')).toBe(document.activeElement);
    await act(async () => { const slider = host.querySelector<HTMLInputElement>('[data-dimension=width] input[type=range]')!; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(slider, '5400'); slider.dispatchEvent(new Event('input', { bubbles: true })); slider.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.textContent).toContain('$14,445');
    expect(events.mock.calls.filter(call => call[1] === 'design_start')).toHaveLength(1);
    const href = host.querySelector<HTMLAnchorElement>('a[data-channel-action=design_start]')!.href;
    expect(isConfiguratorEntry(new URL(href), window.location.origin)).toBe(true);
    await act(async () => root.render(<Designer/>));
    window.history.replaceState({}, '', withLandingDesignScope('/configurator-preview?open=1&source_path=%2Faluminium-pergolas-auckland'));
    await act(async () => designer!.setRoof({ ...designer!.roof, infills: true, acrylicTint: 'opal' }));
    expect(new URL(designEnquiryHref(), window.location.origin).searchParams.get('source_path')).toBe('/aluminium-pergolas-auckland');
    window.history.replaceState({}, '', '/aluminium-pergolas-auckland');
    await mount();
    expect(host.textContent).toContain('$16,665');
    expect(host.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Synthetic Customer');
    await act(async () => root.unmount()); root = createRoot(host); await mount();
    expect(host.querySelector<HTMLInputElement>('[aria-label="Width in metres"]')!.value).toBe('5.4');
    expect(host.textContent).toContain('Your selected design is included');
    await submit();
    expect(submissions.at(-1)).toMatchObject({ page: '/aluminium-pergolas-auckland', phone: '', customerDesign: { input: { widthMm: 5400 }, roof: { infills: true, acrylicTint: 'opal' } }, calculationRef: 'cf1.fixture' });
    expect(sessionStorage.getItem(PREVIEW_DRAFT_KEY)).toBe(originalDraft);
    expect(JSON.parse(sessionStorage.getItem(LANDING_DRAFT_KEY)!)).toMatchObject({ input: { widthMm: 5400 }, roof: { infills: true, acrylicTint: 'opal' } });
    accept = true; await submit(); expect(host.textContent).toContain('Your enquiry has been sent.');
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
