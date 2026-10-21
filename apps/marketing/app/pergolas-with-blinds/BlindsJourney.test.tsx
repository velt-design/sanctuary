import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_PREVIEW_DRAFT } from '../../components/configurator-prototype/previewDraft';
import { resolveBlindsContext } from './blindsContext';

import { GOOGLE_FUNNEL_ENQUIRE_EVENT } from '../../lib/googleFunnel';
import BlindsJourney from './BlindsJourney';

const h = vi.hoisted(() => ({ chosen: false, setRoof: vi.fn(), network: vi.fn() }));
vi.mock('../../components/configurator-prototype/usePreviewDraft', () => ({
  usePreviewDraft: () => ({ ...DEFAULT_PREVIEW_DRAFT, input: { ...DEFAULT_PREVIEW_DRAFT.input, widthMm: 5400 },
    roof: { ...DEFAULT_PREVIEW_DRAFT.roof, family: 'gable', infills: true }, ready: true, hasChosenDraft: h.chosen,
    storageAvailable: true, setRoof: h.setRoof }),
}));
vi.mock('../../components/configurator-prototype/useConfiguratorPrice', () => ({ useConfiguratorPrice: () => ({ price: { status: 'unavailable' } }) }));
vi.mock('../../components/ConsentProvider', () => ({ useConsent: () => ({
  consent: { analytics: false, marketing: false }, hasTrackingDecision: true, trackingBasis: 'consent', trackingRegionPolicy: 'strict',
}) }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); h.chosen = false; h.setRoof.mockReset(); h.network.mockReset();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', h.network);
  window.history.replaceState({}, '', '/pergolas-with-blinds');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const contexts = [
  resolveBlindsContext({}).context,
  resolveBlindsContext({ source_experience: 'guided-home-v1', source_pathway: 'outdoor-room', source_focus: 'poolside', source_path: '/outdoor-rooms-auckland' }).context,
  resolveBlindsContext({ project: 'outdoor-room', priorities: 'entertaining,daylight', reference: 'tindalls-bay-pavilion' }).context,
];
it.each(contexts)('retains the starting brief through direct enquiry, failure and configured confirmation: $sourceExperience', async context => {
  h.network.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'Synthetic retry' }) });
  await act(async () => root.render(<BlindsJourney context={context}/>));
  expect(host.textContent).not.toContain('Your saved starting design will be included');
  expect(host.querySelector<HTMLInputElement>('[name=phone]')!.required).toBe(false);
  expect(host.querySelector<HTMLInputElement>('[name=page]')!.value).toBe('/pergolas-with-blinds');
  expect(JSON.parse(host.querySelector<HTMLInputElement>('[name=enquiryContext]')!.value)).toMatchObject({ source_path: context.sourcePath });
  expect(host.querySelector('[data-enquiry-attachments]')).not.toBeNull();
  await act(async () => {
    for (const [name, value] of Object.entries({ name: 'Synthetic Blinds', email: 'blinds@example.invalid', suburb: 'Albany', message: 'Low afternoon sun on the right side.' })) {
      const input = host.querySelector<HTMLInputElement>(`[name=${name}]`)!;
      input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  const direct = JSON.parse(h.network.mock.calls[0][1].body);
  expect(direct.customerDesign).toBeUndefined();
  expect(direct).toMatchObject({ phone: '', page: '/pergolas-with-blinds', enquiryIntent: 'bespoke', requestType: 'project-discussion',
    enquiryContext: { source_path: context.sourcePath, ...(context.sourceExperience ? { source_experience: context.sourceExperience } : {}) } });
  await act(async () => window.dispatchEvent(new Event(GOOGLE_FUNNEL_ENQUIRE_EVENT)));
  expect(h.setRoof).toHaveBeenCalledWith(expect.objectContaining({ family: 'gable', infills: true }));
  h.chosen = true;
  await act(async () => root.render(<BlindsJourney context={context}/>));
  expect(host.textContent).toContain('Your saved starting design will be included');
  const designer = host.querySelector<HTMLAnchorElement>('a[data-channel-action="design_start"]')!;
  const params = new URL(designer.href).searchParams;
  expect(params.get('source_path')).toBe(context.sourcePath);
  expect(params.get('source_experience')).toBe(context.sourceExperience ?? null);
  expect(params.get('design_scope')).toBe('pergolas-auckland');
  expect(host.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Synthetic Blinds');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const configured = JSON.parse(h.network.mock.calls[1][1].body);
  expect(configured).toMatchObject({ submissionId: direct.submissionId, message: 'Low afternoon sun on the right side.',
    customerDesign: { input: { widthMm: 5400 }, roof: { family: 'gable', infills: true } }, enquiryContext: direct.enquiryContext });
});
