'use client';

import { useEffect, useRef } from 'react';
import { useConsent } from '@/components/ConsentProvider';
import {
  HOME_PATH,
  HOME_VARIANT,
  isProjectIntent,
} from './matching';

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

const trackedEvents = new Set([
  'design_conversation_start',
  'design_conversation_intent_select',
  'design_conversation_project_open',
  'design_conversation_reference_select',
  'design_conversation_general_enquiry_click',
  'design_conversation_capability_open',
  'design_conversation_support_open',
]);
const enquiryAudiences = new Set([
  'residential',
  'commercial',
  'professional',
]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getViewportCategory() {
  if (window.innerWidth <= 640) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

function safeSlug(value: string | undefined): string | undefined {
  return value && value.length <= 100 && slugPattern.test(value)
    ? value
    : undefined;
}

function safeMatchedProjects(value: string | undefined): string[] | undefined {
  const projects = value
    ?.split(',')
    .map((project) => safeSlug(project.trim()))
    .filter((project): project is string => Boolean(project));

  return projects?.length ? projects.slice(0, 2) : undefined;
}

function pushEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
) {
  const trackingWindow = window as TrackingWindow;
  trackingWindow.dataLayer = trackingWindow.dataLayer || [];
  trackingWindow.dataLayer.push({
    event: eventName,
    homepage_variant: HOME_VARIANT,
    viewport_category: getViewportCategory(),
    source_path: HOME_PATH,
    ...properties,
  });
}

export default function HomepageDesignConversationTracker() {
  const { consent } = useConsent();
  const trackedViewRef = useRef(false);

  useEffect(() => {
    if (!consent.analytics) return;

    if (!trackedViewRef.current) {
      trackedViewRef.current = true;
      pushEvent('design_conversation_view');
    }

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const trigger = event.target.closest<HTMLElement>(
        '[data-design-conversation-event], [data-homepage-event="header_estimate_click"]',
      );
      const eventName = trigger?.dataset.designConversationEvent
        ?? (
          trigger?.dataset.homepageEvent === 'header_estimate_click'
            ? 'design_conversation_general_enquiry_click'
            : undefined
        );
      if (!trigger || !eventName || !trackedEvents.has(eventName)) return;

      const projectIntent = isProjectIntent(trigger.dataset.projectIntent)
        ? trigger.dataset.projectIntent
        : undefined;
      const selectedProject = safeSlug(trigger.dataset.selectedProject);
      const matchedProjects = safeMatchedProjects(
        trigger.dataset.matchedProjects,
      );
      const enquiryType = trigger.dataset.enquiryType
        && enquiryAudiences.has(trigger.dataset.enquiryType)
        ? trigger.dataset.enquiryType
        : undefined;
      const destination = trigger.closest<HTMLAnchorElement>('a[href]')
        ?.getAttribute('href');
      const stepNumber = Number.parseInt(trigger.dataset.stepNumber ?? '', 10);

      const properties = {
        ...(projectIntent ? { project_intent: projectIntent } : {}),
        ...(selectedProject ? { selected_project: selectedProject } : {}),
        ...(matchedProjects ? { matched_projects: matchedProjects } : {}),
        ...(enquiryType ? { enquiry_type: enquiryType } : {}),
        ...(destination ? { destination } : {}),
        ...(Number.isFinite(stepNumber) ? { step_number: stepNumber } : {}),
      };

      pushEvent(eventName, properties);
      if (eventName === 'design_conversation_intent_select') {
        pushEvent('design_conversation_match_view', properties);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [consent.analytics]);

  return null;
}
