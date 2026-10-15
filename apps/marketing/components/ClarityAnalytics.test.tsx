import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ analytics: false, marketing: false, decision: false, path: '/', search: '' }));
vi.hoisted(() => { process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = 'example123'; });
vi.mock('./ConsentProvider', () => ({ useConsent: () => ({ consent: state, hasTrackingDecision: state.decision }) }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path, useSearchParams: () => new URLSearchParams(state.search) }));
import ClarityAnalytics from './ClarityAnalytics';
import { clarityPageAllowed, clarityProjectId, sendClarityJourneyEvent, type ClarityWindow } from '../lib/clarityTracking';
let root: ReturnType<typeof createRoot>;
const target = window as ClarityWindow;
beforeEach(() => {
  Object.assign(state, { analytics: false, marketing: false, decision: false, path: '/', search: '' });
  root = createRoot(document.createElement('div'));
  delete target.clarity;
  delete target.sanctuaryClarityActive;
});
afterEach(async () => { await React.act(async () => root.unmount()); document.querySelector('#sp-clarity')?.remove(); vi.unstubAllGlobals(); });
const render = async () => { await React.act(async () => root.render(<ClarityAnalytics />)); };

it('loads only after an analytics decision, updates ad consent and stops on withdrawal', async () => {
  await render(); expect(document.querySelector('#sp-clarity')).toBeNull();
  state.decision = true; state.marketing = true;
  await render(); expect(document.querySelector('#sp-clarity')).toBeNull();
  state.analytics = true; state.marketing = false;
  await render(); expect(document.querySelector('#sp-clarity')?.getAttribute('src')).toBe('https://www.clarity.ms/tag/example123');
  expect(target.clarity?.q).toContainEqual(['consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' }]);
  const runtime = vi.fn(); target.clarity = runtime;
  state.marketing = true; await render(); expect(runtime).toHaveBeenCalledWith('consentv2', { analytics_Storage: 'granted', ad_Storage: 'granted' });
  state.analytics = false; await render(); expect(runtime).toHaveBeenLastCalledWith('stop');
  expect(target.sanctuaryClarityActive).toBe(false);
  state.analytics = true; await render(); expect(runtime).toHaveBeenLastCalledWith('start');
  expect(document.querySelectorAll('#sp-clarity')).toHaveLength(1);
});
it('excludes initial private pages and stops when navigation enters one', async () => {
  state.decision = state.analytics = true; state.path = '/quote/private-token';
  await render(); expect(document.querySelector('#sp-clarity')).toBeNull();
  state.path = '/'; await render(); target.clarity = vi.fn<(...args: unknown[]) => void>();
  state.path = '/design-enquiry'; state.search = 'staff_project=private'; await render();
  expect(target.clarity).toHaveBeenLastCalledWith('stop');
  expect(clarityPageAllowed('/invoice/example', '')).toBe(false);
  expect(clarityPageAllowed('/', 'draft=private')).toBe(false);
  expect(clarityPageAllowed('/simple-pergolas-auckland', '')).toBe(true);
  expect(clarityPageAllowed('/auckland-outdoor-living', 'utm_source=facebook&utm_medium=paid_social&utm_campaign=auckland_residential&utm_content=riverhead&fbclid=synthetic')).toBe(true);
  expect(clarityPageAllowed('/auckland-outdoor-living', 'email=private@example.test')).toBe(false);
  expect(clarityPageAllowed('/pergolas-auckland/redesign', 'utm_source=google')).toBe(true);
  expect(clarityPageAllowed('/pergolas-auckland/redesign', 'draft=private')).toBe(false);
  expect(clarityPageAllowed('/design-enquiry', 'source_path=%2F&project_direction=cover')).toBe(true);
  expect(clarityPageAllowed('/design-enquiry', 'project_direction=private-value')).toBe(false);
  expect(clarityPageAllowed('/configurator-preview', 'design_scope=pergolas-auckland&source_product=gable&entry=edit')).toBe(true);
  expect(clarityPageAllowed('/design-enquiry', 'design_scope=private-customer')).toBe(false);
  expect(clarityPageAllowed('/design-enquiry', 'design_scope=pergolas-auckland&source_product=private-customer')).toBe(false);
  expect(clarityPageAllowed('/configurator-preview', 'entry=private-note')).toBe(false);
  expect(clarityProjectId('https://other.example')).toBeNull();
});
it('sends only approved stage names, and replay failures do not throw', () => {
  target.clarity = vi.fn<(...args: unknown[]) => void>(); target.sanctuaryClarityActive = true;
  vi.stubGlobal('location', { pathname: '/', search: '' });
  sendClarityJourneyEvent('design_review'); sendClarityJourneyEvent('private-name');
  expect(target.clarity).toHaveBeenCalledExactlyOnceWith('event', 'design_review');
  target.clarity = () => { throw new Error('vendor'); };
  expect(() => sendClarityJourneyEvent('design_review')).not.toThrow();
});

it('contains lifecycle vendor exceptions during grant, update and withdrawal', async () => {
  target.clarity = () => { throw new Error('vendor unavailable'); };
  state.decision = state.analytics = true;
  await expect(render()).resolves.toBeUndefined();
  expect(target.sanctuaryClarityActive).toBe(false);
  target.clarity = vi.fn<(...args: unknown[]) => void>();
  state.marketing = true; await render();
  expect(target.sanctuaryClarityActive).toBe(true);
  target.clarity = () => { throw new Error('stop unavailable'); };
  state.analytics = false;
  await expect(render()).resolves.toBeUndefined();
  expect(target.sanctuaryClarityActive).toBe(false);
});

const metaPaths = ['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland'];
const campaignQuery = 'utm_source=facebook&utm_medium=paid_social&utm_campaign=99200&utm_content=99401&utm_term=99300';
const campaignId = '12345678901234567890'; // Deliberately exceeds JS safe integer precision.
it.each(metaPaths)('allows one bounded public campaign ID on %s without widening private routes', path => {
  expect(clarityPageAllowed(path, campaignQuery)).toBe(true);
  expect(clarityPageAllowed(path, `${campaignQuery}&utm_id=${campaignId}`)).toBe(true);
  for (const suffix of ['utm_id=', 'utm_id=0', 'utm_id=0123', 'utm_id=-1', 'utm_id=1.2', 'utm_id=1e3',
    'utm_id=%20' + campaignId, 'utm_id=private%40example.test', 'utm_id=' + '1'.repeat(21),
    `utm_id=${campaignId}&utm_id=${campaignId}`, `utm_id=${campaignId}&utm_id=`,
    `utm_id=private&utm_id=${campaignId}`, `utm_id=${campaignId}&%75tm_id=99200`,
    `utm_id=${campaignId}&email=private%40example.test`, `utm_id=${campaignId}&utm_private=secret`]) {
    expect(clarityPageAllowed(path, `${campaignQuery}&${suffix}`), suffix).toBe(false);
  }
  expect(clarityPageAllowed('/quote/private-token', `utm_id=${campaignId}`)).toBe(false);
});
it.each(metaPaths)('keeps campaign-ID SDK lifecycle behind consent and stops on unsafe navigation on %s', async path => {
  state.path = path; state.search = `${campaignQuery}&utm_id=${campaignId}`;
  const network = vi.fn(() => { throw new Error('No vendor requests in fixture'); }); vi.stubGlobal('fetch', network);
  await render(); expect(document.querySelector('#sp-clarity')).toBeNull();
  state.decision = true; state.marketing = true;
  await render(); expect(document.querySelector('#sp-clarity')).toBeNull();
  state.analytics = true; state.marketing = false;
  await render(); expect(document.querySelectorAll('#sp-clarity')).toHaveLength(1);
  expect(target.clarity?.q).toContainEqual(['consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' }]);
  expect(target.sanctuaryClarityActive).toBe(true);
  // Simulate the installed SDK; jsdom does not fetch external scripts.
  const sdk = vi.fn(); target.clarity = sdk;
  state.analytics = false; await render();
  expect(sdk).toHaveBeenCalledWith('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
  expect(sdk).toHaveBeenLastCalledWith('stop'); expect(target.sanctuaryClarityActive).toBe(false);
  state.analytics = true; await render(); expect(sdk).toHaveBeenLastCalledWith('start');
  state.search += '&email=private%40example.test'; await render();
  expect(sdk).toHaveBeenLastCalledWith('stop'); expect(target.sanctuaryClarityActive).toBe(false);
  state.search = `${campaignQuery}&utm_id=${campaignId}`; await render();
  expect(sdk).toHaveBeenLastCalledWith('start');
  state.path = '/quote/private-token'; await render();
  expect(sdk).toHaveBeenLastCalledWith('stop'); expect(target.sanctuaryClarityActive).toBe(false);
  expect(document.querySelectorAll('#sp-clarity')).toHaveLength(1); expect(network).not.toHaveBeenCalled();
  expect(JSON.stringify(sdk.mock.calls)).not.toMatch(/12345678901234567890|private%40|99200|99401/);
});
it.each(metaPaths)('does not install the SDK on initially ambiguous campaign IDs on %s', async path => {
  state.path = path; state.decision = state.analytics = true;
  state.search = `${campaignQuery}&utm_id=${campaignId}&utm_id=${campaignId}`;
  await render(); expect(document.querySelector('#sp-clarity')).toBeNull(); expect(target.clarity).toBeUndefined();
  state.search = `${campaignQuery}&utm_id=${campaignId}&unknown=private`;
  await render(); expect(document.querySelector('#sp-clarity')).toBeNull();
});
it.each(metaPaths)('retains closed journey events without ID payloads on %s', path => {
  const sdk = vi.fn(); target.clarity = sdk; target.sanctuaryClarityActive = true;
  vi.stubGlobal('location', { pathname: path, search: `${campaignQuery}&utm_id=${campaignId}` });
  sendClarityJourneyEvent('design_review');
  expect(sdk).toHaveBeenCalledExactlyOnceWith('event', 'design_review');
  vi.stubGlobal('location', { pathname: path, search: `${campaignQuery}&utm_id=${campaignId}&utm_id=99200` });
  sendClarityJourneyEvent('design_review'); expect(sdk).toHaveBeenCalledTimes(1);
});
