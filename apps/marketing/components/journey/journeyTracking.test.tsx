import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DecisionTrackingRegion from './DecisionTrackingRegion';
import { useEnquiryInteraction } from '../enquiry/useEnquiryInteraction';

let allowed = true;
vi.mock('../ConsentProvider', () => ({ useConsent: () => ({ consent: { analytics: allowed }, hasTrackingDecision: true }) }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let gtag: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); allowed = true;
  gtag = vi.fn(); vi.stubGlobal('gtag', gtag);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function Form() {
  const interaction = useEnquiryInteraction('contact', false, allowed);
  return <form onInputCapture={interaction} onChangeCapture={interaction}><input aria-label="Name" defaultValue="Restored personal value" /></form>;
}
const input = () => act(async () => host.querySelector('input')!.dispatchEvent(new Event('input', { bubbles: true })));

it('records first actual input once without reading restored or entered values', async () => {
  await act(async () => root.render(<Form />));
  expect(gtag).not.toHaveBeenCalled();
  await input(); await input();
  expect(gtag).toHaveBeenCalledTimes(1);
  expect(gtag).toHaveBeenCalledWith('event', 'contact_form_interaction', {
    event_category:'contact', form_surface:'contact', configured_design:false, contact_funnel_version:'v1', send_to:'G-KGLF83X6JW',
  });
});
it('does not replay a denied first edit after consent is enabled', async () => {
  allowed = false; await act(async () => root.render(<Form />)); await input();
  allowed = true; await act(async () => root.render(<Form />)); await input();
  expect(gtag).not.toHaveBeenCalled();
});
it('records only closed click codes and never raw links or text; denied clicks are not replayed', async () => {
  const render = () => act(async () => root.render(<DecisionTrackingRegion source="cost_guide">
    <a href="/contact?private=do-not-record#private" data-journey-action="help" data-journey-destination="enquiry" onClick={e => e.preventDefault()}>Private text</a>
    <a href="/products" data-journey-action="arbitrary" data-journey-destination="product" onClick={e => e.preventDefault()}>Unknown</a>
  </DecisionTrackingRegion>));
  allowed = false; await render(); await act(async () => host.querySelector('a')!.click());
  allowed = true; await render(); expect(gtag).not.toHaveBeenCalled();
  await act(async () => host.querySelector('a')!.click());
  await act(async () => host.querySelectorAll('a')[1]!.click());
  expect(gtag).toHaveBeenCalledTimes(1);
  expect(gtag).toHaveBeenCalledWith('event', 'journey_decision_click', {
    event_category:'journey',journey_version:'v1',decision_source:'cost_guide',decision_action:'help',destination_category:'enquiry',send_to:'G-KGLF83X6JW',
  });
});
