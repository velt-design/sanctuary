import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MetaPixel from './MetaPixel';
import ContactEnquiryForm from '../app/contact/ContactEnquiryForm';
import { buildContactDesignBrief } from '../app/contact/contactDesignBrief';
import { DEFAULT_PREVIEW_DRAFT } from './configurator-prototype/previewDraft';
import { GET } from '../app/runtime-meta.js/route';

const state = vi.hoisted(() => ({ marketing: true, decision: true,
  script: null as null | { src: string; onReady?: () => void } }));
vi.mock('@/components/ConsentProvider', () => ({ useConsent: () => ({
  consent: { analytics: false, marketing: state.marketing }, hasTrackingDecision: state.decision,
  trackingBasis: 'user_choice', trackingRegionPolicy: 'consent_required',
}) }));
vi.mock('next/script', () => ({ default: (props: { src: string; onReady?: () => void }) => {
  state.script = props; return null;
} }));

type PixelWindow = Window & { fbq?: { (...args: unknown[]): void; queue: ArrayLike<unknown>[] }; _fbq?: unknown; dataLayer?: unknown[] };
let host: HTMLDivElement, root: ReturnType<typeof createRoot>, anchor: HTMLScriptElement;
const network = vi.fn();
const design = buildContactDesignBrief({ ...DEFAULT_PREVIEW_DRAFT, result: null, configuratorPrice: { status: 'disabled' } });
const render = () => act(async () => root.render(<><MetaPixel /><ContactEnquiryForm compactConfigured
  configuredDesign={design} initialEnquiryType="residential"
  initialContext={{ sourcePath: '/acrylic-roof-pergolas-auckland' }} /></>));
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('NEXT_PUBLIC_FB_PIXEL_ID', '111111111');
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENHANCED_LEADS_ENABLED', 'false');
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  state.marketing = true; state.decision = true; state.script = null;
  localStorage.clear(); sessionStorage.clear(); network.mockReset();
  network.mockImplementation(async (url: string) => {
    if (url !== '/api/enquiry') throw new Error('Unexpected fixture network request');
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  vi.stubGlobal('fetch', network);
  anchor = document.createElement('script'); document.head.append(anchor);
  // Never insert or fetch Meta's vendor script. Only its first-party queue is exercised.
  vi.spyOn(document.head, 'insertBefore').mockImplementation(node => node);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); anchor.remove();
  for (const key of ['fbq', '_fbq', 'dataLayer'] as const) delete (window as PixelWindow)[key];
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
async function submit(accepted = true) {
  await act(async () => {
    for (const [name, value] of Object.entries({ name: 'Synthetic Fixture', suburb: 'Albany', email: 'fixture@example.test' })) {
      const input = host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(host.textContent).toContain(accepted ? 'Your enquiry has been sent.' : 'Synthetic connection lost');
  return JSON.parse(network.mock.calls[0][1].body).submissionId as string;
}
async function loadRuntime() {
  await act(async () => vi.advanceTimersByTime(2800));
  expect(state.script?.src).toBe('/runtime-meta.js');
  const script = await GET().text();
  new Function('window', 'document', script)(window, document);
  state.script?.onReady?.();
}
const leads = () => ((window as PixelWindow).fbq?.queue ?? []).map(args => Array.from(args))
  .filter(args => args[0] === 'track' && args[1] === 'Lead');

it('retains an accepted fixture form Lead until the existing delayed pixel is ready', async () => {
  await render(); const id = await submit();
  expect((window as PixelWindow).fbq).toBeUndefined();
  await loadRuntime();
  expect(leads()).toHaveLength(1);
  expect(leads()[0][3]).toEqual({ eventID: id });
  expect(network.mock.calls.map(call => call[0])).toEqual(['/api/enquiry']);
});

it('preserves the ordinary already-ready path', async () => {
  await render(); await loadRuntime(); const id = await submit();
  expect(leads()).toHaveLength(1); expect(leads()[0][3]).toEqual({ eventID: id });
});

it('keeps the same submission UUID through a failed response and successful retry', async () => {
  network.mockRejectedValueOnce(new Error('Synthetic connection lost'));
  await render(); await submit(false); const id = await submit(); await loadRuntime();
  expect(network.mock.calls.map(call => JSON.parse(call[1].body).submissionId)).toEqual([id, id]);
  state.script?.onReady?.();
  expect(leads()).toHaveLength(1); expect(leads()[0][3]).toEqual({ eventID: id });
  expect(JSON.stringify(leads())).not.toMatch(/fixture@example|Synthetic Fixture/);
});

it('clears an accepted pending event when marketing permission is withdrawn', async () => {
  await render(); await submit(); state.marketing = false; await render();
  await act(async () => vi.advanceTimersByTime(2800));
  expect(state.script).toBeNull();
  state.marketing = true; await render(); await loadRuntime();
  expect(leads()).toHaveLength(0);
});

it.each([{ marketing: false, decision: true }, { marketing: true, decision: false }])(
  'does not emit a Lead for missing or denied tracking permission: %j', async permission => {
    Object.assign(state, permission); await render(); await submit();
    if (permission.marketing) await loadRuntime();
    expect(leads()).toHaveLength(0);
  },
);
