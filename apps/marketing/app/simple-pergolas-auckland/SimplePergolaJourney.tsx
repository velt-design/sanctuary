'use client';

import type { ReactNode, SyntheticEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import AcrylicPergolaEnquiryForm from '@/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm';
import { useConsent } from '@/components/ConsentProvider';
import { Container } from '@/components/marketing-foundation';
import SimpleCoverCalculator from '@/components/simple-cover-calculator/SimpleCoverCalculator';
import type { EnquiryContext } from '@/lib/enquiryContext';
import {
  getSimpleCoverViewportCategory,
  pushSimpleCoverFunnelEvent,
} from '../../lib/simpleCoverAnalytics';
import {
  readStoredSimpleCoverHandoff,
  storeSimpleCoverHandoff,
  type SimpleCoverHandoff,
} from '@/lib/simpleCoverHandoff';
import styles from './simple-pergolas-auckland.module.css';

const route = '/simple-pergolas-auckland' as const;

type SimplePergolaJourneyProps = {
  children: ReactNode;
  sourceContext: EnquiryContext;
};

function revealEnquiry(): void {
  const section = document.getElementById('initial-estimate');
  const heading = document.getElementById('estimate-form-title');
  if (!section || !heading) return;

  section.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
    block: 'start',
  });
  heading.setAttribute('tabindex', '-1');
  heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), {
    once: true,
  });
  window.requestAnimationFrame(() => heading.focus({ preventScroll: true }));
}

function handoffAnnouncement(handoff: SimpleCoverHandoff): string {
  return handoff.status === 'priced'
    ? 'Your estimate is ready for a site measure request.'
    : 'Your selected cover is ready for Sanctuary review.';
}

export default function SimplePergolaJourney({
  children,
  sourceContext,
}: SimplePergolaJourneyProps) {
  const { consent } = useConsent();
  const [handoff, setHandoff] = useState<SimpleCoverHandoff | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const formStartTracked = useRef(false);
  const reviewOnlyHandoff = handoff?.status === 'custom'
    || handoff?.status === 'unavailable';

  useEffect(() => {
    if (window.location.hash !== '#initial-estimate') return;
    const storedHandoff = readStoredSimpleCoverHandoff();
    if (!storedHandoff) return;

    setHandoff(storedHandoff);
    setAnnouncement(handoffAnnouncement(storedHandoff));
    window.requestAnimationFrame(revealEnquiry);
  }, []);

  function continueToEnquiry(nextHandoff: SimpleCoverHandoff) {
    storeSimpleCoverHandoff(nextHandoff);
    setHandoff(nextHandoff);
    setAnnouncement(handoffAnnouncement(nextHandoff));
    window.history.replaceState(window.history.state, '', '#initial-estimate');
    window.setTimeout(revealEnquiry, 0);
  }

  function trackFormStart(event: SyntheticEvent<HTMLElement>) {
    if (
      formStartTracked.current
      || !consent.analytics
      || !(event.target instanceof Element)
      || !event.target.matches('input:not([type="hidden"]), select, textarea, button')
      || !event.target.closest('form')
    ) {
      return;
    }

    const didTrack = pushSimpleCoverFunnelEvent('simple_calculator_form_start', {
      placement: 'embedded',
      result_status: handoff?.status ?? 'pending',
      source_path: route,
      viewport_category: getSimpleCoverViewportCategory(window.innerWidth),
      calculation_attached: Boolean(
        handoff?.status === 'priced' && handoff.calculationRef,
      ),
    });
    if (didTrack) formStartTracked.current = true;
  }

  return (
    <>
      <section
        className={styles.calculatorSection}
        id="price-your-cover"
        aria-label="Price your Simple cover"
        data-simple-price-integration="full-calculator"
      >
        <SimpleCoverCalculator
          placement="embedded"
          onContinue={continueToEnquiry}
        />
      </section>

      {children}

      <section
        className={styles.estimate}
        id="initial-estimate"
        aria-label={reviewOnlyHandoff
          ? 'Simple pergola configuration review enquiry'
          : 'Simple pergola site measure request'}
        onFocusCapture={trackFormStart}
        onChangeCapture={trackFormStart}
      >
        <div className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </div>
        <Container width="wide">
          <AcrylicPergolaEnquiryForm
            variant="simple-cover"
            simpleCoverEstimate={handoff}
            initialEnquiryType="residential"
            sourceContext={sourceContext}
            eyebrow="Next step"
            heading={reviewOnlyHandoff
              ? 'Ask Sanctuary to review your cover.'
              : 'Request a site measure.'}
            intro={reviewOnlyHandoff
              ? 'Add your suburb and contact details, plus photos if you have them. Sanctuary will review the selections and recommend the right next step.'
              : 'Add your suburb and contact details, plus photos if you have them. Sanctuary will review the estimate and confirm whether a site measure is the right next step.'}
            submitLabel={reviewOnlyHandoff
              ? 'Send for Sanctuary review'
              : 'Request a site measure'}
            successHeading={reviewOnlyHandoff
              ? 'Your cover is with Sanctuary.'
              : 'Site measure request sent.'}
            successMessage="We’ll review the configuration and contact you to confirm the next step."
            messageLabel="Anything Sanctuary should know?"
            messagePlaceholder="For example: where you want to retain daylight, or an exposed side you would like us to consider."
          />
        </Container>
      </section>
    </>
  );
}
