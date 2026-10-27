// @vitest-environment-options {"url":"https://www.sanctuarypergolas.co.nz/"}
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConsentProvider, useConsent } from './ConsentProvider';
import MetaPixel from './MetaPixel';
import ContactEnquiryForm from '../app/contact/ContactEnquiryForm';
import { buildContactDesignBrief } from '../app/contact/contactDesignBrief';
import { DEFAULT_PREVIEW_DRAFT } from './configurator-prototype/previewDraft';
import { CONSENT_STORAGE_KEY, createStoredConsent, serializeConsent } from '../lib/consent';
import { setMetaLeadPermission } from '../lib/metaLead';

vi.mock('next/script', () => ({ default: () => null }));

let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
let withdraw = () => {};
let settle: (value: unknown) => void = () => {};
const network = vi.fn(), pixel = vi.fn();
const design = buildContactDesignBrief({ ...DEFAULT_PREVIEW_DRAFT, result: null, configuratorPrice: { status: 'disabled' } });
function CaptureConsent() {
  const { setConsent } = useConsent();
  withdraw = () => setConsent({ analytics: false, marketing: false });
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENHANCED_LEADS_ENABLED', 'false');
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(CONSENT_STORAGE_KEY, serializeConsent(createStoredConsent({ analytics: false, marketing: true })));
  network.mockReset(); pixel.mockReset();
  network.mockImplementation((url: string) => {
    if (url !== '/api/enquiry') throw new Error('Unexpected fixture network request');
    return new Promise(resolve => { settle = resolve; });
  });
  vi.stubGlobal('fetch', network);
  Object.assign(window, { fbq: pixel });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  setMetaLeadPermission(false); host.remove();
  for (const key of ['fbq', 'dataLayer', 'gtag'] as const) delete (window as Window & { fbq?: unknown; dataLayer?: unknown; gtag?: unknown })[key];
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
async function startEnquiry() {
  await act(async () => root.render(<ConsentProvider><CaptureConsent /><MetaPixel />
    <ContactEnquiryForm compactConfigured configuredDesign={design} initialEnquiryType="residential"
      initialContext={{ sourcePath: '/acrylic-roof-pergolas-auckland' }} /></ConsentProvider>));
  await act(async () => {
    for (const [name, value] of Object.entries({ name: 'Synthetic Fixture', suburb: 'Albany', email: 'fixture@example.test' })) {
      const input = host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(network).toHaveBeenCalledTimes(1);
}
const success = () => settle({ ok: true, status: 200, json: async () => ({ ok: true }) });

it('emits one Lead through the actual consent provider for an ordinary accepted response', async () => {
  await startEnquiry();
  await act(async () => { success(); await Promise.resolve(); await Promise.resolve(); });
  expect(host.textContent).toContain('Your enquiry has been sent.');
  expect(pixel).toHaveBeenCalledTimes(1);
  expect(pixel.mock.calls[0].slice(0, 2)).toEqual(['track', 'Lead']);
});

it.each(['same-tab choice', 'storage event'] as const)(
  'revokes permission synchronously on %s before a pending response and React commit, even when storage fails', async via => {
    await startEnquiry();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Synthetic storage unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Synthetic storage unavailable'); });
    await act(async () => {
      if (via === 'same-tab choice') withdraw();
      else window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_STORAGE_KEY,
        newValue: serializeConsent(createStoredConsent({ analytics: false, marketing: false })) }));
      // Resolve while the real provider's state updates are still batched.
      success(); await Promise.resolve(); await Promise.resolve();
    });
    expect(host.textContent).toContain('Your enquiry has been sent.');
    expect(pixel).not.toHaveBeenCalled();
  },
);
