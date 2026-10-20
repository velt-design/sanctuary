'use client';
import { useEffect } from 'react';
import { usePreviewDraft } from '../../components/configurator-prototype/usePreviewDraft';
import { useConfiguratorPrice } from '../../components/configurator-prototype/useConfiguratorPrice';
import { withLandingDesignScope } from '../../components/configurator-prototype/draftScope';
import ChannelDesignReview from '../../components/journey/ChannelDesignReview';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import { buildConfiguratorEnquiryHref } from '../../lib/configuratorEntry';
import { GOOGLE_FUNNEL_ENQUIRE_EVENT } from '../../lib/googleFunnel';
import type { EnquiryContext } from '../../lib/enquiryContext';
import ContactEnquiryForm from '../contact/ContactEnquiryForm';
import { buildContactDesignBrief } from '../contact/contactDesignBrief';
import { enquiryDesignSummary } from '../design-enquiry/enquiryDesignSummary';
import styles from './outdoor-rooms.module.css';

export default function OutdoorRoomJourney({ context }: { context: EnquiryContext }) {
  const state = usePreviewDraft();
  const draft = { version: 1 as const, input: state.input, roof: state.roof };
  const { price } = useConfiguratorPrice(draft, state.ready && state.hasChosenDraft);
  const brief = state.hasChosenDraft
    ? buildContactDesignBrief({ ...draft, result: null, configuratorPrice: price }) : undefined;
  const designerHref = withLandingDesignScope(buildConfiguratorEnquiryHref(context));
  useEffect(() => {
    // Include even an unchanged starting design when explicitly confirmed in 3D.
    const include = () => state.setRoof(state.roof);
    window.addEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
    return () => window.removeEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
  }, [state.roof, state.setRoof]);

  return <>
    <section className={styles.enquiry} id="project-details" aria-labelledby="enquiry-title">
      <div><p className={styles.eyebrow}>Start with how you want to live</p><h2 id="enquiry-title">What would your <br/>room make possible?</h2><p>Tell us about the space and what you would like to do there. Dining, relaxing, poolside living, or a little of each. You can add photos or plans if you have them.</p><p>We’ll review your ideas, talk through the next step and arrange a site measure where appropriate. No measurements or finished design needed.</p><a className={styles.textLink} href="tel:+64228545633">Prefer to talk? 022 854 5633 <ArrowUpRight/></a></div>
      <div className={styles.formPanel}>
        {state.hasChosenDraft && <div className={styles.savedDesign}><p>Your saved starting design will be included with this enquiry.</p><ChannelDesignReview rows={enquiryDesignSummary(draft)} className={styles.designReview}/><a href={designerHref} className={styles.textLink} data-channel-action="design_start">Edit your starting design <ArrowUpRight/></a><p className={styles.small}>This is a standard pergola starting point. We’ll confirm the wider room layout, services, scope and price with you.</p></div>}
        <ContactEnquiryForm initialEnquiryType="residential" initialIntent="bespoke" initialContext={context} configuredDesign={brief} compactConfigured compactAttachments funnel/>
        {!state.storageAvailable && <p className={styles.small} role="status">Your browser cannot save the design for a return visit. Your current choices can still go with this enquiry.</p>}
      </div>
    </section>
    <aside className={styles.designer} aria-labelledby="designer-title"><div><p className={styles.eyebrow}>An optional starting point</p><h2 id="designer-title">Explore a pergola shape in 3D.</h2><p>Try standard shapes, sizes and options, then bring your choices to the conversation. The estimate covers that pergola configuration, not a complete room, landscaping or bespoke layout.</p></div><a className={styles.secondary} href={designerHref} data-channel-action="design_start">Open the 3D designer <ArrowUpRight/></a></aside>
  </>;
}
