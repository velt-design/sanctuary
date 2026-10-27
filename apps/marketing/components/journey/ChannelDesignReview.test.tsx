// @vitest-environment-options {"url":"https://www.sanctuarypergolas.co.nz/"}
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChannelDesignReview from './ChannelDesignReview';
import ChannelTrackingRegion from './ChannelTrackingRegion';
vi.mock('../ConsentProvider', () => ({ useConsent: () => ({ consent: { analytics: true }, hasTrackingDecision: true }) }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const send = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('gtag', send); send.mockReset(); sessionStorage.clear();
  window.history.replaceState({}, '', '/pergolas-auckland');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await React.act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it('requires a deliberate summary opening and keeps direct CTA distinct from design enquiry', async () => {
  const render = () => <ChannelTrackingRegion><ChannelDesignReview rows={[{ label: 'Size', value: 'Private dimensions' }]}/><a href="#project-details" data-channel-action="quote">Get a quote</a><a href="#project-details" data-channel-action="design_enquiry_open">Enquire about this design</a></ChannelTrackingRegion>;
  await React.act(async () => root.render(render()));
  expect(send).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Private dimensions');
  await React.act(async () => { host.querySelector('details')!.open = true; host.querySelector('details')!.dispatchEvent(new Event('toggle')); });
  await React.act(async () => root.render(render()));
  await React.act(async () => { host.querySelectorAll('a')[0].click(); host.querySelectorAll('a')[1].click(); host.querySelectorAll('a')[1].click(); });
  expect(send.mock.calls.map(call => call[1])).toEqual(['design_review', 'journey_decision_click', 'design_enquiry_open']);
  expect(JSON.stringify(send.mock.calls)).not.toContain('Private dimensions');
});
