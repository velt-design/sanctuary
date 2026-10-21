'use client';
import { createContext, useContext, useEffect, useState, Fragment, type ReactNode } from 'react';
import { useConsent } from '../ConsentProvider';
import { getBrowserMarketingAttribution } from '../../lib/attribution';
import { isExperimentPath, LANDING_COPY, LANDING_ORIGINAL_TEXT, EXPERIMENT_SEEN_EVENT,rememberLandingExperience,parseLandingAssignment, parseLandingCopies, type ExperimentPath, type LandingCopies, type LandingSlot } from '../../lib/landingExperiment';
import template from '../../data/landing-template.generated.json';

const Context = createContext<LandingCopies>({});
const ORIGINAL_CONTROL: LandingCopies = {};
export function LandingExperiment({ path, children, control = ORIGINAL_CONTROL }: { path: string; children: ReactNode; control?: LandingCopies }) {
  const context = useConsent();
  const [copies, setCopies] = useState<LandingCopies>(control);
  useEffect(() => {
    setCopies(control);
    if (!context.hasTrackingDecision || !context.consent.analytics || !context.consent.marketing) return;
    if (process.env.NEXT_PUBLIC_LANDING_EXPERIMENT_ENABLED !== 'true' || !isExperimentPath(path)) return;
    const controller = new AbortController();
    const attribution = getBrowserMarketingAttribution(context), utm = attribution.utm;
    if (utm.utm_source !== 'facebook' || utm.utm_medium !== 'paid_social') return;
    const paid = Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].map(key => [key, utm[key]]));
    const post = (body: unknown) => fetch('/api/landing-experiment', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    void (async () => {
      const response = await post({ stage: 'assign', path, consent: true, utm: paid });
      if (!response.ok) return;
      const value = await response.json();
      if (controller.signal.aborted) return;
      const assignment = parseLandingAssignment(value.assignment);
      if (!assignment) { setCopies(parseLandingCopies(value.controlCopies) ?? control); return; }
      if (assignment.path !== path) return;
      setCopies(assignment.copies);
      // Count an exposed assignment only after the selected text has painted.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (!controller.signal.aborted) {
        rememberLandingExperience(path,assignment.receipt);
        window.dispatchEvent(new CustomEvent(EXPERIMENT_SEEN_EVENT,{detail:{path,receipt:assignment.receipt}}));
        await post({ stage: 'expose', path, consent: true, receipt: assignment.receipt });
      }
    })().catch(() => { if (!controller.signal.aborted) setCopies(control); });
    return () => controller.abort();
  }, [path, control, context.hasTrackingDecision, context.consent.analytics, context.consent.marketing, context.trackingBasis, context.trackingRegionPolicy]);
  return <Context.Provider value={copies}><div style={{ display: 'contents' }} data-landing-template={template.hash}>{children}</div></Context.Provider>;
}
export function LandingCopy({ slot, children }: { slot: LandingSlot; children: ReactNode }) {
  const key = useContext(Context)[slot], copy = key ? LANDING_COPY[key] : null;
  return <span data-landing-copy={slot} data-landing-copy-key={copy?.slot === slot ? key : 'control'}>{copy?.slot === slot ? copy.text : children}</span>;
}
export function OriginalLandingCopy({path,slot}:{path:ExperimentPath;slot:LandingSlot}) {
  return <>{LANDING_ORIGINAL_TEXT[path][slot].split('\n').map((line,index)=><Fragment key={index}>{index>0&&<br/>}{line}</Fragment>)}</>;
}
