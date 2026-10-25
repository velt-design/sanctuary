import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimpleCoverHandoff } from '@/lib/simpleCoverHandoff';
import AcrylicPergolaEnquiryForm from './AcrylicPergolaEnquiryForm';
import { webcrypto } from 'node:crypto';

let root: Root | null = null;
let analyticsEnabled = false;
let marketingEnabled = false;

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/components/marketing-foundation', () => ({
  Eyebrow: ({ children, ...props }: { children: ReactNode }) => <p {...props}>{children}</p>,
  Heading: ({ children, ...props }: { children: ReactNode }) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ConsentProvider', () => ({
  useConsent: () => ({
    consent: { analytics: analyticsEnabled, marketing: marketingEnabled },
    hasTrackingDecision: true,
    trackingBasis: 'user_choice',
    trackingRegionPolicy: 'consent_required',
  }),
}));

vi.mock('@/lib/attribution', () => ({
  getBrowserMarketingAttribution: () => ({ utm: {} }),
}));

vi.mock('@/lib/enquiryAttachments', () => ({
  createEnquirySubmissionId: () => 'c314107a-a893-4f4f-a306-f50dc507fea4',
  ENQUIRY_ATTACHMENT_ACCEPT: '.pdf,.jpg,.jpeg,.png,.webp',
  ENQUIRY_ATTACHMENT_LIMITS: { maxFiles: 8 },
  uploadEnquiryAttachments: async () => ({ uploadSessionToken: '', files: [] }),
  validateEnquiryAttachments: () => null,
}));

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  analyticsEnabled = false; marketingEnabled = false;
  localStorage.clear();
  window.history.replaceState({}, '', '/simple-pergolas-auckland');
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.body.innerHTML = '';
});

const pricedHandoff: SimpleCoverHandoff = {
  schemaVersion: 'simple-cover-handoff.v1',
  status: 'priced',
  input: {
    widthMm: 6_000,
    projectionMm: 3_000,
    level: 'elevated',
    connection: 'soffit',
  },
  calculationRef: 'sc1.opaque-server-reference',
  displayedPriceIncGst: 28_000,
  configurationVersion: 7,
};

type SubmittedPayload = {
  enquiryType: string;
  calculationRef: string | null;
  simpleCoverStatus: string;
  dimensions: { widthM: number | null; depthM: number | null; heightM: number | null };
  style: string;
  roofMaterials: string[];
  projectDetails: {
    simpleCover: Record<string, unknown>;
  };
};

async function renderForm(estimate: SimpleCoverHandoff) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <AcrylicPergolaEnquiryForm
        variant="simple-cover"
        simpleCoverEstimate={estimate}
        initialEnquiryType="residential"
        sourceContext={{
          enquiryType: 'residential',
          sourcePath: '/simple-pergolas-auckland',
          sourceComponent: 'embedded_form',
        }}
      />,
    );
  });
  return container;
}

function fillRequiredFields(container: HTMLElement) {
  (container.querySelector('[name="name"]') as HTMLInputElement).value = 'Test Customer';
  (container.querySelector('[name="phone"]') as HTMLInputElement).value = '021 123 4567';
  (container.querySelector('[name="email"]') as HTMLInputElement).value = 'customer@example.test';
}

describe('AcrylicPergolaEnquiryForm Simple cover variant', () => {
  it('omits enhanced contact identity when an edited retry receives the original idempotent receipt',async()=>{
    marketingEnabled=true;vi.stubGlobal('crypto',webcrypto);vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENHANCED_LEADS_ENABLED','true');
    const identityReads:unknown[]=[];const layer:Record<string,unknown>[]=[];
    layer.push=(...events)=>{identityReads.push((window as Window & {sanctuaryGoogleEnhancedLead?:unknown}).sanctuaryGoogleEnhancedLead);return Array.prototype.push.apply(layer,events);};
    vi.stubGlobal('dataLayer',layer);
    const network=vi.spyOn(globalThis,'fetch').mockRejectedValueOnce(Error('Lost response')).mockResolvedValueOnce({ok:true,json:async()=>({ok:true,idempotentReplay:true})} as Response);
    const container=await renderForm(pricedHandoff);fillRequiredFields(container);
    expect(container.textContent).toContain('Google Ads and Meta');
    const submit=()=>act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
    await submit();(container.querySelector('[name=email]') as HTMLInputElement).value='edited@example.test';await submit();
    const bodies=network.mock.calls.map(call=>JSON.parse(String(call[1]?.body)));
    expect(bodies[0].submissionId).toBe(bodies[1].submissionId);expect(bodies[1].email).toBe('edited@example.test');
    expect(container.textContent).toContain('Your earlier enquiry was received.');
    expect(container.textContent).toContain('Changes made after your first send attempt are not included');
    expect(container.textContent).not.toContain('Project brief sent.');
    expect(localStorage.getItem('sanctuary.enquiry-drafts.v1')).toContain('edited@example.test');
    await act(async () => root?.unmount()); root = null;
    const restored = await renderForm(pricedHandoff);
    expect(restored.querySelector<HTMLInputElement>('[name=email]')?.value).toBe('edited@example.test');
    expect(identityReads).toEqual([undefined]);expect(JSON.stringify(layer)).not.toContain('edited@example');
    (layer[0].eventCallback as ()=>void)();
  });
  it('tracks one first edit separately from submission and never reports a failed receipt as success', async () => {
    analyticsEnabled = true;
    const gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok:false, json:async()=>({error:'Try again.'}) } as Response);
    const container = await renderForm(pricedHandoff); fillRequiredFields(container);
    expect(gtag).not.toHaveBeenCalled();
    await act(async () => {
      container.querySelector('[name=name]')!.dispatchEvent(new Event('input', {bubbles:true}));
      container.querySelector('[name=email]')!.dispatchEvent(new Event('input', {bubbles:true}));
      container.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
    });
    expect(gtag.mock.calls.filter(call => call[1] === 'contact_form_interaction')).toHaveLength(1);
    expect(gtag.mock.calls.filter(call => call[1] === 'contact_success')).toHaveLength(0);
  });
  it.each([[true, false], [false, true], [false, false]])('gates success categories with analytics=%s marketing=%s and reconciles the receipt ID', async (analytics, marketing) => {
    analyticsEnabled = analytics; marketingEnabled = marketing;
    const gtag = vi.fn(); const fbq = vi.fn(); const layer: Record<string, unknown>[] = [];
    vi.stubGlobal('gtag', gtag); vi.stubGlobal('fbq', fbq); vi.stubGlobal('dataLayer', layer);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response);
    const container = await renderForm(pricedHandoff); fillRequiredFields(container);
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true})); });
    if (analytics) expect(gtag).toHaveBeenCalledWith('event', 'contact_success', expect.objectContaining({send_to:'G-KGLF83X6JW', lead_event_id:'c314107a-a893-4f4f-a306-f50dc507fea4'}));
    else expect(gtag).not.toHaveBeenCalled();
    expect(fbq.mock.calls.length).toBe(marketing ? 1 : 0);
    expect(layer.filter(event => event.event === 'lead_submitted')).toHaveLength(analytics || marketing ? 1 : 0);
    if (analytics || marketing) expect(layer[0].lead_event_id).toBe('c314107a-a893-4f4f-a306-f50dc507fea4');
  });
  it('submits only the opaque reference as pricing authority for a priced handoff', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    const container = await renderForm(pricedHandoff);
    fillRequiredFields(container);

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as SubmittedPayload;
    expect(body).toMatchObject({
      enquiryType: 'residential',
      advertisingDisclosureVersion: '2026-10-sale-measurement-v2',
      calculationRef: pricedHandoff.calculationRef,
      simpleCoverStatus: 'priced',
      dimensions: { widthM: null, depthM: null, heightM: null },
      style: 'pitched',
      roofMaterials: ['acrylic'],
      projectDetails: {
        simpleCover: { status: 'priced', calculationAttached: true },
      },
    });
    expect(body.projectDetails.simpleCover).not.toHaveProperty('deckLevel');
    expect(body.projectDetails.simpleCover).not.toHaveProperty('connection');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('28000');
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('displayedPriceIncGst');
  });

  it('keeps non-priced selections useful without claiming a calculation reference', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    const customHandoff: SimpleCoverHandoff = {
      ...pricedHandoff,
      status: 'custom',
      calculationRef: null,
      displayedPriceIncGst: null,
      configurationVersion: null,
    };
    const container = await renderForm(customHandoff);
    fillRequiredFields(container);

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
      }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as SubmittedPayload;
    expect(body.calculationRef).toBeNull();
    expect(body.simpleCoverStatus).toBe('custom');
    expect(body.dimensions).toEqual({ widthM: 6, depthM: 3, heightM: null });
    expect(body.projectDetails.simpleCover).toMatchObject({
      deckLevel: 'elevated',
      connection: 'soffit',
      calculationAttached: false,
    });
  });
});
