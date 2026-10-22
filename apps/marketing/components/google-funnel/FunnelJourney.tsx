'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePreviewDraft } from '../configurator-prototype/usePreviewDraft';
import { buildContactDesignBrief } from '../../app/contact/contactDesignBrief';
import ContactEnquiryForm from '../../app/contact/ContactEnquiryForm';
import { enquiryDesignSummary } from '../../app/design-enquiry/enquiryDesignSummary';
import { isGoogleFunnelPath, GOOGLE_FUNNEL_ENQUIRE_EVENT, type InlineFunnelPath } from '../../lib/googleFunnel';
import { buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';
import { useConsent } from '../ConsentProvider';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import FunnelControls from './FunnelControls';
import FunnelEstimate, { useFunnelEstimate } from './FunnelEstimate';
import styles from './funnel.module.css';
import ChannelDesignReview from '../journey/ChannelDesignReview';
import { trackChannelAction } from '../../lib/channelDesignTracking';

export default function FunnelJourney({ path, children, afterEnquiry, showPrivacyFooter = true }: { path: InlineFunnelPath; children: ReactNode; afterEnquiry?: ReactNode; showPrivacyFooter?: boolean }) {
  const state = usePreviewDraft();
  const [attached, setAttached] = useState(false);
  const { openBanner, bannerOpen, consent, hasTrackingDecision } = useConsent();
  const allowed = hasTrackingDecision && consent.analytics;
  useEffect(() => {
    setAttached(state.hasChosenDraft);
    const include = () => setAttached(true);
    window.addEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
    return () => window.removeEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
  }, [path, state.hasChosenDraft]);
  const draft = { version: 1 as const, input: state.input, roof: state.roof };
  const price = useFunnelEstimate(draft, state.ready, attached);
  const context = { enquiryType: 'residential' as const, sourcePath: path, sourceComponent: 'embedded_form' as const };
  const brief = attached ? buildContactDesignBrief({ ...draft, result: null, configuratorPrice: price.canonical }) : undefined;
  const designerHref = buildConfiguratorEnquiryHref(context);
  const meta = !isGoogleFunnelPath(path);
  function includeDesign() { setAttached(true); state.setRoof(state.roof); }
  return <>
    <section className={styles.designer} data-consent-open={bannerOpen} id="your-design" aria-labelledby="design-title">
      <header className={styles.designHeading}><h2 id="design-title">Explore your pergola.</h2><p>Choose a size and roof. See an installed estimate.</p></header>
      <div className={styles.designGrid}><FunnelControls state={state} onEdit={() => { setAttached(true); trackChannelAction('design_start', allowed); trackChannelAction('design_edit', allowed); }}>
        <div className={styles.priceAction}>
          <FunnelEstimate state={price}/>
          <a className={styles.primary} href="#project-details" data-channel-action="design_enquiry_open" onClick={includeDesign}>Enquire about this design <ArrowUpRight/></a>
        </div>
        {meta && <a className={styles.designerLink} href={designerHref} onClick={includeDesign}>Explore your design in 3D <ArrowUpRight/></a>}
        <details className={styles.more}><summary>Blinds, screens, lighting and more <span aria-hidden="true">+</span></summary><p>Explore sides, lighting, timber finishes, gable details and house connections in your 3D design. Your choices stay with your enquiry.</p>{!meta && <a href={designerHref} onClick={includeDesign}>Open the full designer <ArrowUpRight/></a>}</details>
        <ChannelDesignReview className={styles.details} rows={[...enquiryDesignSummary(draft), { label: 'Level', value: state.input.level === 'ground' ? 'Ground level' : 'Elevated' }]}/>
        <a className={styles.quiet} href="#project-details" data-channel-action="quote">Not sure yet? Tell us about your space</a>
      </FunnelControls></div>
      {state.selectionNotice && <p role="status" className={styles.notice}>{state.selectionNotice}</p>}
      {!state.storageAvailable && <p role="status" className={styles.notice}>Your browser cannot save this design for another visit. Your current choices still go with your enquiry.</p>}
    </section>
    {children}
    <section className={styles.enquiry} id="project-details" aria-labelledby="enquiry-title"><div><p className={styles.eyebrow}>Your outdoor space</p><h2 id="enquiry-title">Let’s make it<br/>work for you.</h2><p>Tell us your suburb and how you’d like to use the space. You don’t need a finished design.</p><p>We’ll review your enquiry and contact you to discuss your space and the next step. If a site measure would help, we’ll arrange a time with you.</p><p className={styles.small}>Outside Auckland, we confirm availability and travel costs before a visit. An enquiry does not book an appointment.</p><p className={styles.small}>Can’t represent your project in the designer? Describe it in your message. We can help with a bespoke design.</p><a className={styles.phone} href="tel:+64228545633">Prefer to talk? 022 854 5633</a></div><div className={styles.formPanel}>{attached && <details className={styles.attached}><summary>Your selected design is included</summary><dl>{enquiryDesignSummary(draft).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><a href="#your-design">Change your choices</a></details>}<ContactEnquiryForm initialEnquiryType="residential" initialIntent="help" initialContext={context} configuredDesign={brief} compactConfigured funnel/></div></section>
    {afterEnquiry}
    {showPrivacyFooter && <div className={styles.privacy}><span>Sanctuary Pergolas</span><div><a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a><button type="button" onClick={openBanner}>Privacy settings</button></div></div>}
  </>;
}
