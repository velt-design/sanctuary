import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ContactEnquiryForm from './ContactEnquiryForm';
import { buildContactDesignBrief } from './contactDesignBrief';
import { DEFAULT_PREVIEW_DRAFT } from '../../components/configurator-prototype/previewDraft';
import { createHash, webcrypto } from 'node:crypto';
let marketingEnabled=false;

vi.mock('@/components/ConsentProvider', () => ({ useConsent: () => ({
  consent: { analytics: false, marketing: marketingEnabled }, hasTrackingDecision: true,
  trackingBasis: 'consent', trackingRegionPolicy: 'strict',
}) }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const network = vi.fn();
beforeEach(() => {
  marketingEnabled=false;localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', network); network.mockReset(); sessionStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); vi.unstubAllGlobals();vi.unstubAllEnvs(); });
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
  await render(); await fill(); await render(5200);
  expect(host.querySelector('a[href="/privacy#advertising-measurement"]')).not.toBeNull();
  await submit();
  expect(host.textContent).toContain('Please try again.');
  expect(host.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Fixture Customer');
  await submit();
  const bodies = network.mock.calls.map((call)=>JSON.parse(call[1].body));
  expect(network.mock.calls.map(call=>call[0])).toEqual(['/api/enquiry','/api/enquiry']);
  expect(bodies[0].submissionId).toBe(bodies[1].submissionId);
  expect(bodies[1].customerDesign.input.widthMm).toBe(5200);
  expect(bodies[1].enquiryContext.source_path).toBe('/products');
  expect(bodies[1].advertisingDisclosureVersion).toBe('2026-10-sale-measurement-v2');
  expect(bodies[1].phone).toBe(''); expect(bodies[1].message).toBe('');
  expect(host.textContent).toContain('Your enquiry has been sent.');
  expect(sessionStorage.getItem('sanctuary-enquiry-contact-v1')).toBeNull();
});

it('identifies an earlier receipt after a lost response and edited retry without claiming the new design was sent',async()=>{
  marketingEnabled=true;vi.stubGlobal('crypto',webcrypto);vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENHANCED_LEADS_ENABLED','true');
  const identityReads:unknown[]=[];const layer:Record<string,unknown>[]=[];
  layer.push=(...events)=>{identityReads.push((window as Window & {sanctuaryGoogleEnhancedLead?:unknown}).sanctuaryGoogleEnhancedLead);return Array.prototype.push.apply(layer,events);};
  vi.stubGlobal('dataLayer',layer);
  network.mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true,idempotentReplay:true})});
  await render(); await fill(); await submit();
  await render(5200);host.querySelector<HTMLInputElement>('[name=email]')!.value='changed@example.test';await submit();
  const bodies = network.mock.calls.map(call=>JSON.parse(call[1].body));
  expect(bodies[0].submissionId).toBe(bodies[1].submissionId);
  expect(bodies[0].customerDesign.input.widthMm).toBe(6000);
  expect(bodies[1].customerDesign.input.widthMm).toBe(5200);
  expect(host.textContent).toContain('Your earlier enquiry was received.');
  expect(host.textContent).toContain('Changes made after your first send attempt are not included');
  expect(host.textContent).not.toContain('Your design is shown here for reference.');
  expect(host.querySelector('[role=status]')).toBe(document.activeElement);
  expect(sessionStorage.getItem('sanctuary-enquiry-contact-v1')).toContain('Fixture Customer');
  expect(identityReads).toEqual([undefined]);expect(JSON.stringify(layer)).not.toContain('changed@example');
  (layer[0].eventCallback as ()=>void)();
});
it.each([[false,false],[true,false],[true,true]])('shows the v2 Google and Meta notice for compact=%s mobile=%s',async(compactConfigured,mobileFinish)=>{
  await act(async()=>root.render(<ContactEnquiryForm compactConfigured={compactConfigured} mobileFinish={mobileFinish} configuredDesign={brief()} initialEnquiryType="residential" initialContext={{sourcePath:'/products'}}/>));
  expect(host.textContent).toContain('Google Ads and Meta');expect(host.querySelector('a[href="/privacy#advertising-measurement"]')).not.toBeNull();
});

it.each([
  ['/ads/outdoor-living',false],['/ads/outdoor-living',true],
  ['/ads/acrylic-pergolas',false],['/ads/acrylic-pergolas',true],
] as const)('emits email-only enhanced identity after accepted %s enquiry, configured=%s',async(page,configured)=>{
  marketingEnabled=true;vi.stubGlobal('crypto',webcrypto);vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENHANCED_LEADS_ENABLED','true');
  const priorPath=window.location.href;window.history.replaceState({},'',page);
  const target=window as Window & {sanctuaryGoogleEnhancedLead?:unknown};
  const reads:unknown[]=[];const layer:Record<string,unknown>[]=[];
  layer.push=(...events)=>{reads.push(target.sanctuaryGoogleEnhancedLead);return Array.prototype.push.apply(layer,events);};
  vi.stubGlobal('dataLayer',layer);
  Object.defineProperty(target,'sanctuaryGoogleEnhancedLead',{configurable:true,value:{sha256_phone_number:'stale'}});
  network.mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true})});
  try {
    await act(async()=>root.render(<ContactEnquiryForm funnel compactConfigured configuredDesign={configured?brief():undefined}
      initialEnquiryType="residential" initialIntent="help"
      initialContext={{enquiryType:'residential',sourcePath:page,sourceComponent:'embedded_form'}}/>));
    await fill();await submit();
    // React act does not await the Web Crypto digest used by the Ads handoff.
    await vi.waitFor(()=>expect(layer).toHaveLength(1));
    const payload=JSON.parse(network.mock.calls[0][1].body);
    expect(payload.phone).toBe('');expect(payload.page).toBe(page);expect(Boolean(payload.customerDesign)).toBe(configured);
    expect(reads).toEqual([{sha256_email_address:createHash('sha256').update('fixture@example.test').digest('hex')}]);
    expect(layer).toHaveLength(1);expect(layer[0]).toMatchObject({event:'lead_submitted',enquiry_type:'residential',source_path:page});
    expect(JSON.stringify(layer)).not.toContain('fixture@example');expect(JSON.stringify(layer)).not.toContain('sha256');
    (layer[0].eventCallback as ()=>void)();expect(target.sanctuaryGoogleEnhancedLead).toBeUndefined();
  } finally {delete target.sanctuaryGoogleEnhancedLead;window.history.replaceState({},'',priorPath);}
});
