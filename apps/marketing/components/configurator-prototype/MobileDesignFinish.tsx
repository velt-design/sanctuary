'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ContactEnquiryForm from '../../app/contact/ContactEnquiryForm';
import { buildContactDesignBrief } from '../../app/contact/contactDesignBrief';
import { parseEnquiryContext, type EnquiryContext } from '../../lib/enquiryContext';
import { designEnquiryHref } from './configuratorOverlay';
import type { PreviewSelection } from './ConfiguratorPrototype';
import type { RailSection } from './RailProvider';
import type { SharedEstimate } from './sharedEstimate';
import { getRoofFinish } from './roofFinish';
import MobileDesignPortrait from './MobileDesignPortrait';
import DesignReview from './DesignReview';
import ShareDesign from './ShareDesign';
import StaffRevisionReturn from './StaffRevisionReturn';
import css from './mobileFinish.module.css';

export default function MobileDesignFinish({ visible, selection, pricePanel, estimate, onEdit, onExplore, onDetails, notice }: {
  visible: boolean; selection: PreviewSelection; pricePanel: ReactNode; estimate: SharedEstimate | null;
  onEdit: (section: RailSection) => void; onExplore: () => void; onDetails: () => void; notice?: string;
}) {
  const { input, roof } = selection;
  const [enquiring, setEnquiring] = useState(false);
  const [context, setContext] = useState<EnquiryContext>({});
  const form = useRef<HTMLDivElement>(null);
  useEffect(() => { setContext(parseEnquiryContext(Object.fromEntries(new URL(designEnquiryHref(), window.location.origin).searchParams))); }, []);
  const finish = getRoofFinish(roof);
  const brief = buildContactDesignBrief(selection);
  function enquire() {
    setEnquiring(true);
    requestAnimationFrame(() => {
      form.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (!form.current?.contains(document.activeElement)) form.current?.focus({ preventScroll: true });
    });
  }
  return <section hidden={!visible} className={css.finish} aria-label="Your pergola review">
    {visible && <MobileDesignPortrait key={JSON.stringify({input,roof})} input={input} roof={roof} onExplore={onExplore} />}
    <p className={css.spec}>{roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter'} · {(input.widthMm / 1000).toFixed(1)} × {(input.projectionMm / 1000).toFixed(1)} m · {finish.material === 'acrylic' ? 'Acrylic' : finish.material === 'solid' ? 'Solid' : 'Combination'}</p>
    {visible && <><details className={css.edit}><summary>Edit design</summary><DesignReview hideHeading customerChoices input={input} roof={roof} onEdit={onEdit} /><button onClick={onDetails}>Connection & design options</button></details>{notice && <p role="status">{notice}</p>}</>}
    <div className={css.price}>{pricePanel}</div>
    <p className={css.note}>Subject to site confirmation. Foundations, unusual access or fixings, new electrical supply and travel are assessed separately.</p>
    <div className={css.actions}>
      <StaffRevisionReturn draft={{ version: 1, input, roof }} customerAction={<button className={css.primary} onClick={enquire}>Enquire</button>} />
      <p>Save this design with your enquiry.</p>
      <ShareDesign draft={{ version: 1, input, roof }} estimate={estimate} prominent />
      <p>Keep a link to this exact design, or send it to someone.</p>
    </div>
    <div ref={form} hidden={!enquiring} tabIndex={-1} className={css.form}>
      {enquiring && <ContactEnquiryForm initialEnquiryType="residential" initialContext={context} configuredDesign={brief} compactConfigured mobileFinish />}
    </div>
    <p className={css.note}>Concept preview. Structure and connections confirmed at site measure.</p>
  </section>;
}
