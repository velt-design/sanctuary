'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ContactEnquiryForm from '../../app/contact/ContactEnquiryForm';
import { buildContactDesignBrief } from '../../app/contact/contactDesignBrief';
import { parseEnquiryContext, type EnquiryContext } from '../../lib/enquiryContext';
import { designEnquiryHref } from './configuratorOverlay';
import type { PreviewSelection } from './ConfiguratorPrototype';
import type { SharedEstimate } from './sharedEstimate';
import { getRoofFinish } from './roofFinish';
import MobileDesignPortrait from './MobileDesignPortrait';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import ShareDesign from './ShareDesign';
import StaffRevisionReturn from './StaffRevisionReturn';
import { useConsent } from '../ConsentProvider';
import { emitDesignEvent } from './DesignFunnelTracker';
import css from './mobileFinish.module.css';

export default function MobileDesignFinish({ visible, selection, pricePanel, estimate, onEdit, onExplore, notice }: {
  visible: boolean; selection: PreviewSelection; pricePanel: (afterSummary?:ReactNode)=>ReactNode; estimate: SharedEstimate | null;
  onEdit: () => void; onExplore: () => void; notice?: string;
}) {
  const { input, roof } = selection;
  const { consent, hasTrackingDecision } = useConsent();
  const [enquiring, setEnquiring] = useState(false);
  const [context, setContext] = useState<EnquiryContext>({});
  const form = useRef<HTMLDivElement>(null);
  useEffect(() => { setContext(parseEnquiryContext(Object.fromEntries(new URL(designEnquiryHref(), window.location.origin).searchParams))); }, []);
  const finish = getRoofFinish(roof);
  const brief = buildContactDesignBrief(selection);
  function enquire() {
    emitDesignEvent('design_enquiry_open', hasTrackingDecision && consent.analytics);
    if (window.location.pathname === '/design-enquiry') {
      form.current?.closest('dialog')?.close();
      requestAnimationFrame(() => document.getElementById('contact-name')?.focus());
      return;
    }
    setEnquiring(true);
    requestAnimationFrame(() => {
      form.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (!form.current?.contains(document.activeElement)) form.current?.focus({ preventScroll: true });
    });
  }
  return <section hidden={!visible} className={css.finish} aria-label="Your pergola review">
    {visible && <MobileDesignPortrait key={JSON.stringify({input,roof})} input={input} roof={roof} onExplore={onExplore} />}
    <p className={css.spec}>{roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter'} · {(input.widthMm / 1000).toFixed(1)} × {(input.projectionMm / 1000).toFixed(1)} m · {finish.material === 'acrylic' ? 'Acrylic' : finish.material === 'solid' ? 'Solid' : 'Combination'}</p>
    <div className={css.price}>{pricePanel(<><div className={css.actions}>
      <button onClick={onEdit}>Edit design</button>
      <ShareDesign draft={{ version: 1, input, roof }} estimate={estimate} prominent />
    </div>
    {visible && <><div className={css.continue}><StaffRevisionReturn draft={{ version: 1, input, roof }} customerAction={<button onClick={enquire}><span>Enquire</span><ArrowUpRight/></button>} /></div>{notice && <p role="status">{notice}</p>}</>}</>)}</div>
    <p className={css.note}>Concept and estimate subject to site measure. Structure and connections will be confirmed; foundations, unusual access or fixings, new electrical supply and travel are assessed separately.</p>
    <div ref={form} hidden={!enquiring} tabIndex={-1} className={css.form}>
      {enquiring && <ContactEnquiryForm initialEnquiryType="residential" initialContext={context} configuredDesign={brief} compactConfigured mobileFinish />}
    </div>
  </section>;
}
