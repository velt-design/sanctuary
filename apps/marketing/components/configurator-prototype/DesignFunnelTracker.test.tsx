import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DesignFunnelTracker, { emitDesignEvent } from './DesignFunnelTracker';
import type { RailSection } from './RailProvider';

const state = vi.hoisted(() => ({ analytics: true, decision: true, policy: 'consent_required' as string | null }));
vi.mock('../ConsentProvider', () => ({ useConsent: () => ({ consent: { analytics: state.analytics }, hasTrackingDecision: state.decision, trackingRegionPolicy: state.policy }) }));
const send = vi.fn();
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('gtag', send);
  send.mockReset(); state.analytics = true; state.decision = true; state.policy = 'consent_required';
  window.history.replaceState({}, '', '/configurator-preview');
  root = createRoot(document.createElement('div'));
});
afterEach(async () => { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); });

async function render(key: string, section: RailSection = 'structure', active = true, ready = true) {
  await React.act(async () => root.render(<React.StrictMode><DesignFunnelTracker active={active} ready={ready} selectionKey={key} section={section}/></React.StrictMode>));
}
const names = () => send.mock.calls.map(call => call[1]);

it('waits for restoration, counts first edit once, and observes review and reopening without leaking the design', async () => {
  await render('not restored', 'structure', true, false);
  expect(send).not.toHaveBeenCalled();
  await render('private dimensions and lighting');
  await render('private changed dimensions');
  await render('another slider update');
  await render('another slider update', 'review');
  await render('another slider update', 'review');
  expect(names()).toEqual(['design_start', 'design_edit', 'design_review']);
  expect(JSON.stringify(send.mock.calls)).not.toContain('private');
  expect(send.mock.calls[0][2]).toEqual({ event_category: 'configured_design', design_funnel_version: 'v1', source_path: '/configurator-preview', configured_design: true, send_to: 'G-KGLF83X6JW' });
  await render('another slider update', 'review', false);
  await render('another slider update', 'review');
  expect(names()).toEqual(['design_start', 'design_edit', 'design_review', 'design_start', 'design_review']);
});

it('does not backfill denied activity when consent arrives or changes', async () => {
  state.decision = false;
  await render('initial');
  await render('edited', 'review');
  state.decision = true;
  await render('edited', 'review');
  expect(send).not.toHaveBeenCalled();
  await render('edited', 'personalise');
  await render('edited', 'review');
  expect(names()).toEqual(['design_review']);
  state.analytics = false;
  await render('edited', 'personalise');
  await render('edited', 'review');
  expect(names()).toEqual(['design_review']);
});

it('excludes staff and nonpublic routes and tolerates unavailable analytics', () => {
  window.history.replaceState({}, '', '/configurator-preview?staff_project=private');
  expect(emitDesignEvent('design_start', true)).toBe(false);
  window.history.replaceState({}, '', '/qa/private');
  expect(emitDesignEvent('design_start', true)).toBe(false);
  window.history.replaceState({}, '', '/');
  expect(emitDesignEvent('design_start', false)).toBe(false);
  send.mockImplementationOnce(() => { throw new Error('blocked'); });
  expect(emitDesignEvent('design_start', true)).toBe(false);
});

it('waits for regional initialization without replaying edits made before it resolves', async () => {
  state.decision = false; state.policy = null;
  await render('initial');
  await render('edited before region arrived', 'review');
  expect(send).not.toHaveBeenCalled();
  state.decision = true; state.policy = 'nz_automatic';
  await render('edited before region arrived', 'review');
  expect(names()).toEqual(['design_start', 'design_review']);
  await render('edited after region arrived', 'review');
  expect(names()).toEqual(['design_start', 'design_review', 'design_edit']);
});

it('measures public overlay entry pages with bounded route metadata and excludes private pages', () => {
  for (const [path, expected] of [
    ['/simple-pergolas-auckland', '/simple-pergolas-auckland'],
    ['/privacy', '/privacy'], ['/projects/example-project', '/projects/[slug]'],
    ['/products/pergolas/example-product', '/products/[category]/[item]'],
  ]) {
    window.history.replaceState({}, '', path);
    expect(emitDesignEvent('design_start', true)).toBe(true);
    expect(send.mock.calls.at(-1)?.[2].source_path).toBe(expected);
  }
  for (const path of ['/quote/private-id', '/invoice/private-id', '/staff/projects', '/qa/test', '/home-experimental']) {
    window.history.replaceState({}, '', path);
    expect(emitDesignEvent('design_start', true)).toBe(false);
  }
});
