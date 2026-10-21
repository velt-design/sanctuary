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
import styles from './blinds.module.css';
import { BLINDS_ROUTE } from './content';

export default function BlindsJourney({ context, sourceProjectLabel }: { context: EnquiryContext; sourceProjectLabel?: string }) {
  const state = usePreviewDraft();
  const draft = { version: 1 as const, input: state.input, roof: state.roof };
  const { price } = useConfiguratorPrice(draft, state.ready && state.hasChosenDraft);
  const brief = state.hasChosenDraft ? buildContactDesignBrief({ ...draft, result: null, configuratorPrice: price }) : undefined;
  const designerHref = withLandingDesignScope(buildConfiguratorEnquiryHref(context));
  useEffect(() => {
    const include = () => state.setRoof(state.roof);
    window.addEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
    return () => window.removeEventListener(GOOGLE_FUNNEL_ENQUIRE_EVENT, include);
  }, [state.roof, state.setRoof]);

  return <section className={styles.enquiry} id="project-details" aria-labelledby="enquiry-title">
    <div><p className={styles.eyebrow}>Start with your space</p><h2 id="enquiry-title">What would you<br/> like to change?</h2><p>Planning a new pergola, or considering blinds for an existing one? Tell us which side matters and what you want to change: low sun, privacy, exposure or a little of each.</p><p>Photos, plans and approximate measurements are useful if you have them. You do not need a finished design to enquire.</p><p className={styles.small}>We’ll review your ideas, talk through the next step and arrange a free Auckland site measure where appropriate. We usually respond within a working day.</p><a className={styles.textLink} href="tel:+64228545633">Prefer to talk? 022 854 5633 <ArrowUpRight/></a></div>
    <div className={styles.formPanel}>
      {state.hasChosenDraft && <div className={styles.savedDesign}><p>Your saved starting design will be included.</p><ChannelDesignReview rows={enquiryDesignSummary(draft)} className={styles.designReview}/><a className={styles.textLink} href={designerHref} data-channel-action="design_start">Edit your starting design <ArrowUpRight/></a><p className={styles.small}>We’ll confirm the blind system, site suitability and final scope with you.</p></div>}
      <ContactEnquiryForm initialEnquiryType="residential" initialIntent="bespoke" initialContext={context} pagePath={BLINDS_ROUTE} sourceProjectLabel={sourceProjectLabel} configuredDesign={brief} compactConfigured compactAttachments funnel/>
      {!state.storageAvailable && <p className={styles.small} role="status">Your browser cannot save the design for a return visit. Your current choices can still go with this enquiry.</p>}
    </div>
  </section>;
}
