'use client';

import { useEffect, useRef } from 'react';
import { useConsent } from '@/components/ConsentProvider';
import {
  HOME_JOURNEY_PATH,
  HOME_JOURNEY_VARIANT,
} from './journey';

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

const trackedEvents = new Set([
  'home_journey_answer_select',
  'home_journey_back',
  'home_journey_enquiry_click',
]);
const closedValuePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function safeClosedValue(value: string | undefined) {
  return value && value.length <= 100 && closedValuePattern.test(value)
    ? value
    : undefined;
}

function viewportCategory() {
  if (window.innerWidth <= 640) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

function pushEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
) {
  const trackingWindow = window as TrackingWindow;
  trackingWindow.dataLayer = trackingWindow.dataLayer || [];
  trackingWindow.dataLayer.push({
    event: eventName,
    homepage_variant: HOME_JOURNEY_VARIANT,
    viewport_category: viewportCategory(),
    source_path: HOME_JOURNEY_PATH,
    ...properties,
  });
}

export default function JourneyTracker() {
  const { consent } = useConsent();
  const trackedViewRef = useRef(false);

  useEffect(() => {
    if (!consent.analytics) return;

    if (!trackedViewRef.current) {
      trackedViewRef.current = true;
      pushEvent('home_journey_view');
    }

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest<HTMLElement>(
        '[data-home-journey-event]',
      );
      const eventName = trigger?.dataset.homeJourneyEvent;
      if (!trigger || !eventName || !trackedEvents.has(eventName)) return;

      const questionId = safeClosedValue(trigger.dataset.questionId);
      const answerId = safeClosedValue(trigger.dataset.answerId);
      const resultId = safeClosedValue(trigger.dataset.resultId);
      const destination = trigger.closest<HTMLAnchorElement>('a[href]')
        ?.getAttribute('href');
      const stepNumber = Number.parseInt(
        trigger.dataset.stepNumber ?? '',
        10,
      );

      pushEvent(eventName, {
        ...(questionId ? { question_id: questionId } : {}),
        ...(answerId ? { answer_id: answerId } : {}),
        ...(resultId ? { result_id: resultId } : {}),
        ...(destination ? { destination } : {}),
        ...(Number.isFinite(stepNumber)
          ? { step_number: stepNumber }
          : {}),
      });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [consent.analytics]);

  return null;
}

