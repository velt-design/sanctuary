import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ContactEnquiryForm from './ContactEnquiryForm';
import AcrylicPergolaEnquiryForm from '../acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import { ENQUIRY_DRAFT_KEY, ENQUIRY_DRAFT_MAX_AGE } from '../../lib/enquiryDraft';

vi.mock('@/components/ConsentProvider', () => ({ useConsent: () => ({ consent: { analytics: false, marketing: false }, hasTrackingDecision: true, trackingBasis: 'consent', trackingRegionPolicy: 'strict' }) }));
const navigation = vi.hoisted(() => ({ pathname: null as string | null }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('@/components/marketing-foundation', () => ({ Eyebrow: ({ children }: { children: ReactNode }) => <p>{children}</p>, Heading: ({ children, ...props }: { children: ReactNode }) => <h2 {...props}>{children}</h2> }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear(); sessionStorage.clear();
  navigation.pathname = null;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const contact = () => <ContactEnquiryForm initialEnquiryType={null} initialContext={{}}/>;
const mount = (node = contact()) => act(async () => root.render(node));
const unmount = () => act(async () => root.render(null));
const choose = (path: string) => act(async () => host.querySelector<HTMLInputElement>(`#contact-pathway-${path}`)!.click());
const edit = (name: string, value: string) => act(async () => {
  const field = host.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
  field.value = value; field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});

it('restores a chosen pathway before its last contact edit, business fields, budget and optional checks', async () => {
  await mount(); await choose('commercial-professional');
  await act(async () => host.querySelector<HTMLInputElement>('#contact-business-audience-professional')!.click());
  await edit('name', 'Synthetic visitor'); await edit('company', 'Synthetic practice'); await edit('projectRole', 'architect-designer');
  await unmount(); await mount();
  expect(host.querySelector<HTMLInputElement>('[name=enquiryType]')?.value).toBe('professional');
  expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('Synthetic visitor');
  expect(host.querySelector<HTMLInputElement>('[name=company]')?.value).toBe('Synthetic practice');
  expect(host.querySelector<HTMLSelectElement>('[name=projectRole]')?.value).toBe('architect-designer');
  await choose('custom'); await edit('budgetPreference', 'provided'); await edit('budgetHint', 'A synthetic range');
  await act(async () => host.querySelector<HTMLInputElement>('[name=roofMaterials][value=acrylic]')!.click());
  await edit('message', 'The very last edit');
  expect(localStorage.getItem(ENQUIRY_DRAFT_KEY)).toContain('The very last edit');
  await unmount(); await mount();
  expect(host.querySelector<HTMLTextAreaElement>('[name=message]')?.value).toBe('The very last edit');
  expect(host.querySelector<HTMLInputElement>('[name=budgetHint]')?.value).toBe('A synthetic range');
  expect(host.querySelector<HTMLInputElement>('[name=roofMaterials][value=acrylic]')?.checked).toBe(true);
  await act(async () => host.querySelector<HTMLButtonElement>('[data-enquiry-draft] button')!.click());
  expect(JSON.parse(localStorage.getItem(ENQUIRY_DRAFT_KEY)!)).toEqual([]);
  expect(host.querySelector('[name=budgetHint]')).toBeNull();
  await unmount(); await mount();
  expect(host.querySelector('[name=name]')).toBeNull();
});

it('restores embedded custom fields and audience without leaking between different form contexts', async () => {
  const form = (path: string) => <AcrylicPergolaEnquiryForm sourceContext={{ sourcePath: path }} briefFields={[{name:'briefExtra',label:'Additional brief',type:'text'}]}/>;
  await mount(form('/guide-one')); await edit('enquiryType', 'professional'); await edit('name', 'First guide visitor'); await edit('briefExtra', 'Private optional note');
  await mount(form('/guide-two'));
  expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('');
  await unmount(); await mount(form('/guide-one'));
  expect(host.querySelector<HTMLSelectElement>('[name=enquiryType]')?.value).toBe('professional');
  expect(host.querySelector<HTMLInputElement>('[name=briefExtra]')?.value).toBe('Private optional note');
  const stored = localStorage.getItem(ENQUIRY_DRAFT_KEY)!;
  expect(stored).not.toMatch(/experimentReceipt|honeypot|calculationRef|advertisingDisclosure|enquiryContext/);
});

it('consumes the previous configured session draft once into its current compatible context', async () => {
  sessionStorage.setItem('sanctuary-enquiry-contact-v1', JSON.stringify({ name: 'Existing draft visitor', email: 'existing@example.test', message: 'An existing unfinished brief' }));
  const form = (path: string) => <ContactEnquiryForm funnel initialEnquiryType="residential" initialContext={{ sourcePath: path }} initialIntent="help"/>;
  await mount(form('/ads/outdoor-living'));
  expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('Existing draft visitor');
  expect(sessionStorage.getItem('sanctuary-enquiry-contact-v1')).toBeNull();
  await mount(form('/ads/acrylic-pergolas'));
  expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('');
});

it('isolates embedded form owners and project/product references even with identical upstream source and field schema', async () => {
  const form = (project = 'project-a', product = 'product-a') => <AcrylicPergolaEnquiryForm sourceContext={{ sourcePath: '/shared-upstream', sourceProject: project, sourceProduct: product }}/>;
  navigation.pathname = '/guide-a'; await mount(form()); await edit('name', 'Guide A visitor');
  navigation.pathname = '/guide-b'; await mount(form());
  expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('');
  navigation.pathname = '/guide-a'; await mount(form());
  expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('Guide A visitor');
  await mount(form('project-b')); expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('');
  await mount(form('project-a', 'product-b')); expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('');
  await mount(form()); expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('Guide A visitor');
});

it('expires old drafts, rejects corrupt storage and keeps the form usable when storage is denied', async () => {
  await mount(); await choose('help'); await edit('name', 'Expired visitor'); await unmount();
  const stored = JSON.parse(localStorage.getItem(ENQUIRY_DRAFT_KEY)!); stored[0].updated = Date.now() - ENQUIRY_DRAFT_MAX_AGE - 1;
  localStorage.setItem(ENQUIRY_DRAFT_KEY, JSON.stringify(stored)); await mount(); expect(host.querySelector('[name=name]')).toBeNull();
  await unmount(); localStorage.setItem(ENQUIRY_DRAFT_KEY, '{invalid'); await mount(); await choose('help');
  const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  await edit('name', 'Still editable');
  expect(host.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('Still editable');
  expect(host.textContent).toContain('could not save this draft'); denied.mockRestore();
});

it('retains selected files through component return and reports unavailable persistent attachment storage', async () => {
  await mount(); await choose('help');
  await act(async () => {
    const field = host.querySelector<HTMLInputElement>('[name=files]')!;
    Object.defineProperty(field, 'files', { configurable: true, value: [new File(['synthetic'], 'site.png', { type: 'image/png' })] });
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.textContent).toContain('could not save these attachments');
  await unmount(); await mount();
  expect(host.querySelector('[aria-label="Selected files"]')?.textContent).toContain('site.png');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Remove site.png"]')!.click());
  await unmount(); await mount();
  expect(host.querySelector('[aria-label="Selected files"]')).toBeNull();
});
