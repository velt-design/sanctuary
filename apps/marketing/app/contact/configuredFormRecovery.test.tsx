import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ContactEnquiryForm from './ContactEnquiryForm';
import { buildContactDesignBrief } from './contactDesignBrief';
import { DEFAULT_PREVIEW_DRAFT } from '../../components/configurator-prototype/previewDraft';

vi.mock('@/components/ConsentProvider', () => ({ useConsent: () => ({
  consent: { analytics: false, marketing: false }, hasTrackingDecision: true,
  trackingBasis: 'consent', trackingRegionPolicy: 'strict',
}) }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const network = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', network); network.mockReset(); sessionStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); vi.unstubAllGlobals(); });
const brief = (widthMm = 6000) => buildContactDesignBrief({
  ...DEFAULT_PREVIEW_DRAFT, input: { ...DEFAULT_PREVIEW_DRAFT.input, widthMm }, result: null,
  configuratorPrice: {status:'disabled'},
});
const render = (width = 6000) => act(async () => root.render(<ContactEnquiryForm compactConfigured
  configuredDesign={brief(width)} initialEnquiryType="residential" initialContext={{sourcePath:'/products'}} />));
const submit = () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); });
async function fill() {
  await act(async () => {
    for (const [name,value] of Object.entries({name:'Fixture Customer',suburb:'Albany',email:'fixture@example.test'})) {
      const input = host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
}
it('blocks invalid fields before any network call',async()=>{
  await render(); await submit();
  expect(network).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Enter your suburb');
  expect(host.querySelector('[role=alert]')).toBe(document.activeElement);
});
it('retries a failed enquiry with the same submission identity and current design, then clears contact storage',async()=>{
  network.mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:'Please try again.'})})
    .mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true})});
  await render(); await fill(); await render(5200); await submit();
  expect(host.textContent).toContain('Please try again.');
  expect(host.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Fixture Customer');
  await submit();
  const bodies = network.mock.calls.map((call)=>JSON.parse(call[1].body));
  expect(network.mock.calls.map(call=>call[0])).toEqual(['/api/enquiry','/api/enquiry']);
  expect(bodies[0].submissionId).toBe(bodies[1].submissionId);
  expect(bodies[1].customerDesign.input.widthMm).toBe(5200);
  expect(bodies[1].enquiryContext.source_path).toBe('/products');
  expect(bodies[1].phone).toBe(''); expect(bodies[1].message).toBe('');
  expect(host.textContent).toContain('Your enquiry has been sent.');
  expect(sessionStorage.getItem('sanctuary-enquiry-contact-v1')).toBeNull();
});

it('identifies an earlier receipt after a lost response and edited retry without claiming the new design was sent',async()=>{
  network.mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true,idempotentReplay:true})});
  await render(); await fill(); await submit();
  await render(5200); await submit();
  const bodies = network.mock.calls.map(call=>JSON.parse(call[1].body));
  expect(bodies[0].submissionId).toBe(bodies[1].submissionId);
  expect(bodies[0].customerDesign.input.widthMm).toBe(6000);
  expect(bodies[1].customerDesign.input.widthMm).toBe(5200);
  expect(host.textContent).toContain('Your earlier enquiry was received.');
  expect(host.textContent).toContain('Changes made after your first send attempt are not included');
  expect(host.textContent).not.toContain('Your design is shown here for reference.');
  expect(host.querySelector('[role=status]')).toBe(document.activeElement);
  expect(sessionStorage.getItem('sanctuary-enquiry-contact-v1')).toContain('Fixture Customer');
});
