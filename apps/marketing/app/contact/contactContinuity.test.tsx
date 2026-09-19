import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ContactEnquiryForm from './ContactEnquiryForm';

vi.mock('@/components/ConsentProvider', () => ({ useConsent: () => ({
  consent: { analytics: false, marketing: false }, hasTrackingDecision: true,
  trackingBasis: 'consent', trackingRegionPolicy: 'strict',
}) }));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); vi.unstubAllGlobals(); });
const render = (known = true) => act(async () => root.render(<ContactEnquiryForm
  initialIntent={known ? 'bespoke' : undefined} initialEnquiryType={known ? 'residential' : null}
  initialContext={known ? {sourcePath:'/projects/warkworth-outdoor-room',sourceProject:'warkworth-outdoor-room'} : {}}
  sourceProjectLabel={known ? 'Warkworth Outdoor Room' : undefined} />));
const click = (selector: string) => act(async () => host.querySelector<HTMLElement>(selector)!.click());

it('continues the normal project CTA into a brief with its reference attached', async () => {
  await act(async () => root.render(<ContactEnquiryForm initialEnquiryType="residential"
    initialContext={{sourcePath:'/projects/warkworth-outdoor-room',sourceProject:'warkworth-outdoor-room'}}
    sourceProjectLabel="Warkworth Outdoor Room" />));
  expect(host.querySelector('details.contact-form__pathway-choice')?.hasAttribute('open')).toBe(false);
  expect(host.querySelector('summary')?.textContent).toContain('Help me choose');
  expect(host.textContent).toContain('Project: Warkworth Outdoor Room');
  expect(host.querySelector('#contact-name')).not.toBeNull();
});

it('continues a known brief with reference context and keeps the chooser closed', async () => {
  await render();
  expect(host.querySelector('details.contact-form__pathway-choice')?.hasAttribute('open')).toBe(false);
  expect(host.querySelector('summary')?.textContent).toContain('Bespoke design');
  expect(host.querySelector('summary')?.textContent).toContain('Change pathway');
  expect(host.querySelector('#contact-form-title')?.textContent).toBe('Tell us about your bespoke project.');
  expect(host.textContent).toContain('Project: Warkworth Outdoor Room');
  expect(host.querySelector('#contact-name')).not.toBeNull();
});

it('retains neutral entry choices until the visitor chooses a pathway', async () => {
  await render(false);
  expect(host.querySelector('details.contact-form__pathway-choice')?.hasAttribute('open')).toBe(true);
  expect(host.querySelector('#contact-form-title')?.textContent).toBe('Choose the right starting point.');
  expect(host.querySelector('#contact-name')).toBeNull();
  await click('#contact-pathway-help');
  expect(host.querySelector('#contact-name')).not.toBeNull();
  expect(host.querySelector('details.contact-form__pathway-choice')?.hasAttribute('open')).toBe(true);
});

it('changing pathway retains typed contact, brief and source while allowing business audience selection', async () => {
  await render();
  const name = host.querySelector<HTMLInputElement>('#contact-name')!;
  const message = host.querySelector<HTMLTextAreaElement>('#contact-message')!;
  name.value = 'Synthetic Visitor'; message.value = 'Please keep this brief.';
  await click('.contact-form__pathway-choice > summary');
  await click('#contact-pathway-commercial-professional');
  await click('#contact-business-audience-professional');
  host.querySelector<HTMLInputElement>('#contact-company')!.value = 'Synthetic Practice';
  expect(host.querySelector<HTMLInputElement>('[name=enquiryType]')?.value).toBe('professional');
  expect(host.querySelector<HTMLInputElement>('#contact-name')?.value).toBe('Synthetic Visitor');
  expect(host.querySelector<HTMLTextAreaElement>('#contact-message')?.value).toBe('Please keep this brief.');
  expect(host.querySelector<HTMLInputElement>('[name=enquiryContext]')?.value).toContain('warkworth-outdoor-room');
  expect(host.querySelector('details.contact-form__pathway-choice')?.hasAttribute('open')).toBe(true);
  await click('#contact-pathway-custom');
  expect(host.querySelector<HTMLInputElement>('[name=enquiryType]')?.value).toBe('residential');
  expect(host.querySelector<HTMLInputElement>('#contact-name')?.value).toBe('Synthetic Visitor');
  await click('#contact-pathway-commercial-professional');
  expect(host.querySelector<HTMLInputElement>('#contact-company')?.value).toBe('Synthetic Practice');
  expect(host.querySelector<HTMLInputElement>('[name=enquiryType]')?.value).toBe('professional');
});
