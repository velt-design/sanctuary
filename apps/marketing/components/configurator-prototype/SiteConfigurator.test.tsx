import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import SiteConfigurator from './SiteConfigurator';
import { designEnquiryHref, isConfiguratorEntry, openConfigurator, rememberConfiguratorSource } from './configuratorOverlay';

let pathname = '/products';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/dynamic', () => ({ default: () => ({ open, onClose }: { open: boolean; onClose: () => void }) => open ? <dialog open><button onClick={onClose}>Close</button><a href="/design-enquiry">Enquire about this design</a></dialog> : null }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  pathname = '/products'; window.history.replaceState({}, '', '/products?view=roof');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('opens above the current page without changing its URL and closes in place', async () => {
  await act(async () => root.render(<><a href="/configurator-preview?open=1&resume=1">Design</a><SiteConfigurator /></>));
  const before = window.location.href;
  await act(async () => host.querySelector('a')!.click());
  expect(host.querySelector('dialog')).not.toBeNull(); expect(window.location.href).toBe(before);
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('dialog')).toBeNull(); expect(window.location.href).toBe(before);
});

it('supports the homepage entry and carries its attribution into the new enquiry', async () => {
  await act(async () => root.render(<SiteConfigurator />));
  await act(async () => openConfigurator('/contact?configurator=preview&source_path=%2F&source_component=project_finder'));
  expect(host.querySelector('dialog')).not.toBeNull();
  expect(designEnquiryHref()).toContain('/design-enquiry?');
  expect(designEnquiryHref()).toContain('source_component=project_finder');
  pathname = '/design-enquiry'; await act(async () => root.render(<SiteConfigurator />));
  expect(host.querySelector('dialog')).toBeNull();
});

it('leaves bespoke, staff revision and shared-design destinations alone', () => {
  const origin = window.location.origin;
  for (const path of ['/contact?enquiry_intent=bespoke', '/contact', '/configurator-preview?open=1&staff_project=abc', '/configurator-preview?open=1#design=example']) {
    expect(isConfiguratorEntry(new URL(path, origin), origin)).toBe(false);
  }
});

it('keeps the original enquiry source when editing an existing design enquiry', () => {
  rememberConfiguratorSource('/contact?configurator=preview&source_path=%2Fproducts&source_component=product');
  const before = designEnquiryHref();
  window.history.replaceState({}, '', '/design-enquiry');
  rememberConfiguratorSource('/configurator-preview?open=1');
  expect(designEnquiryHref()).toBe(before);
});

it('closes the edit overlay on enquiry return without navigating or clearing entered details', async () => {
  pathname = '/design-enquiry'; window.history.replaceState({}, '', '/design-enquiry?source_path=%2Fproducts');
  await act(async () => root.render(<><input aria-label="Name" defaultValue="Jordan" /><SiteConfigurator /></>));
  await act(async () => openConfigurator('/configurator-preview?open=1'));
  const before = window.location.href;
  await act(async () => host.querySelector<HTMLAnchorElement>('dialog a')!.click());
  expect(host.querySelector('dialog')).toBeNull();
  expect(window.location.href).toBe(before);
  expect(host.querySelector('input')?.value).toBe('Jordan');
});
