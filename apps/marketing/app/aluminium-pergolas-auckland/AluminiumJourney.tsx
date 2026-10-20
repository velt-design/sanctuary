'use client';
import { useEffect, type ReactNode } from 'react';
import { usePreviewDraft } from '../../components/configurator-prototype/usePreviewDraft';
import { withLandingDesignScope } from '../../components/configurator-prototype/draftScope';
import FunnelControls from '../../components/google-funnel/FunnelControls';
import FunnelEstimate, { useFunnelEstimate } from '../../components/google-funnel/FunnelEstimate';
import ChannelDesignReview from '../../components/journey/ChannelDesignReview';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import { useConsent } from '../../components/ConsentProvider';
import { trackChannelAction } from '../../lib/channelDesignTracking';
import { buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';
import { GOOGLE_FUNNEL_ENQUIRE_EVENT } from '../../lib/googleFunnel';
import ContactEnquiryForm from '../contact/ContactEnquiryForm';
import { buildContactDesignBrief } from '../contact/contactDesignBrief';
import { enquiryDesignSummary } from '../design-enquiry/enquiryDesignSummary';
import { ALUMINIUM_ROUTE } from './content';
import styles from './aluminium.module.css';

export default function AluminiumJourney({ children }: { children: ReactNode }) {
  const state = usePreviewDraft();
  const { consent, hasTrackingDecision } = useConsent();
  const draft = { version: 1 as const, input: state.input, roof: state.roof };
  const price = useFunnelEstimate(draft, state.ready, state.hasChosenDraft);
  const context = { enquiryType: 'residential' as const, sourcePath: ALUMINIUM_ROUTE, sourceComponent: 'embedded_form' as const };
  const brief = state.hasChosenDraft ? buildContactDesignBrief({ ...draft, result: null, configuratorPrice: price.canonical }) : undefined;
  const summary = enquiryDesignSummary(draft);
  const includeDesign = () => state.setRoof(state.roof);
  useEffect(() => {
    const include = () => state.setRoof(state.roof);
    window.addEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
    return () => window.removeEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
  }, [state.roof, state.setRoof]);
  const edit = () => { trackChannelAction('design_start', hasTrackingDecision && consent.analytics); trackChannelAction('design_edit', hasTrackingDecision && consent.analytics); };
  return <>
    <section className={styles.estimator} id="your-design" aria-labelledby="estimate-title"><header className={styles.estimateIntro}><div><p className={styles.eyebrow}>An optional starting point</p><h2 id="estimate-title">Get a feel for the price.</h2></div><p>Choose a shape, size and roof finish.<br/>See an initial installed estimate.</p></header><div className={styles.designGrid}><FunnelControls state={state} onEdit={edit} presentation={styles} projectionLabel="Depth" materialLabel="Roof finish">
      <FunnelEstimate state={price} className={styles.estimate}/>
      <a className={styles.primary} href="#project-details" onClick={includeDesign} data-channel-action="design_enquiry_open">Enquire about this design <ArrowUpRight/></a>
      <a className={styles.textLink} href={withLandingDesignScope(buildConfiguratorEnquiryHref(context))} onClick={includeDesign} data-channel-action="design_start">Customise in 3D <ArrowUpRight/></a>
      <p className={styles.small}>Explore blinds, screens, lighting and more. Your choices stay with your enquiry.</p>
      <ChannelDesignReview rows={summary} className={styles.review}/>
      <a className={styles.directLink} href="#project-details" data-channel-action="quote">Prefer to talk it through? Tell us about your space.</a>
    </FunnelControls></div><p className={styles.scope}>Estimate includes the selected structure, roof, priced options, standard installation allowances and GST. Site confirmation, foundations, unusual fixings or access, electrical supply, travel and any engineering or consent are assessed separately.</p>{state.selectionNotice && <p className={styles.notice} role="status">{state.selectionNotice}</p>}{!state.storageAvailable && <p className={styles.notice} role="status">Your browser cannot save choices for a return visit. Your current design can still go with your enquiry.</p>}</section>
    {children}
    <section className={styles.enquiry} id="project-details" aria-labelledby="enquiry-title"><div><p className={styles.eyebrow}>Start with a conversation</p><h2 id="enquiry-title">Tell us about <br/>your space.</h2><p>A few photos and a rough idea are a useful start. Tell us what you would like to cover and what matters to you.</p><p>No drawings or finished design needed. We’ll review your enquiry and contact you about the next step.</p><p className={styles.small}>Free Auckland site measures. Outside Auckland, we confirm availability and any travel costs before a visit.</p><a className={styles.textLink} href="tel:+64228545633">Prefer to talk? 022 854 5633 <ArrowUpRight/></a></div><div className={styles.formPanel}>{state.hasChosenDraft && <details className={styles.review}><summary>Your selected design is included</summary><dl>{summary.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><a className={styles.textLink} href="#your-design">Change your choices <ArrowUpRight/></a></details>}<ContactEnquiryForm initialEnquiryType="residential" initialIntent="help" initialContext={context} configuredDesign={brief} compactConfigured compactAttachments funnel/></div></section>
  </>;
}
