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
  expect(clarityPageAllowed('/design-enquiry', 'source_path=%2F&project_direction=cover')).toBe(true);
  expect(clarityPageAllowed('/design-enquiry', 'project_direction=private-value')).toBe(false);
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
