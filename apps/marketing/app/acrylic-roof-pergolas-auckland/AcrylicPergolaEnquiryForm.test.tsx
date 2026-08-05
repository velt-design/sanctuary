import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimpleCoverHandoff } from '@/lib/simpleCoverHandoff';
import AcrylicPergolaEnquiryForm from './AcrylicPergolaEnquiryForm';

let root: Root | null = null;

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
    consent: { analytics: false, marketing: false },
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
  window.history.replaceState({}, '', '/simple-pergolas-auckland');
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  vi.restoreAllMocks();
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
