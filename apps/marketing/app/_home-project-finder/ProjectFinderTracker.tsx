'use client';

import { useEffect } from 'react';
import { useConsent } from '@/components/ConsentProvider';
import {
  PROJECT_FINDER_HOME_PATH,
  PROJECT_FINDER_HOME_VARIANT,
  isProjectDirection,
  normalizeProjectPriorities,
} from '@/lib/projectFinderContract';

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

const delegatedEvents = new Set([
  'project_finder_start_click',
  'project_pathway_click',
  'project_view_click',
  'project_audience_path_click',
  'project_finder_direct_enquiry_click',
]);

const audiencePaths = new Set(['commercial', 'professional']);

function viewportCategory(): 'mobile' | 'tablet' | 'desktop' {
  if (window.innerWidth <= 640) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

export function pushProjectFinderEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  const trackingWindow = window as TrackingWindow;
  trackingWindow.dataLayer = trackingWindow.dataLayer || [];
  trackingWindow.dataLayer.push({
    event,
    homepage_variant: PROJECT_FINDER_HOME_VARIANT,
    source_path: PROJECT_FINDER_HOME_PATH,
    viewport_category: viewportCategory(),
    ...properties,
  });
}

export default function ProjectFinderTracker() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent.analytics) return;
    pushProjectFinderEvent('project_finder_home_view');

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-project-finder-event]')
        : null;
      const eventName = target?.dataset.projectFinderEvent;
      if (!target || !eventName || !delegatedEvents.has(eventName)) return;

      const direction = isProjectDirection(target.dataset.projectDirection)
        ? target.dataset.projectDirection
        : undefined;
      const priorities = normalizeProjectPriorities(
        (target.dataset.projectPriorities ?? '').split(','),
      );
      const selectedProject = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
        .test(target.dataset.selectedProject ?? '')
        ? target.dataset.selectedProject
        : undefined;
      const stepNumber = Number.parseInt(target.dataset.stepNumber ?? '', 10);
      const audiencePath = audiencePaths.has(target.dataset.audiencePath ?? '')
        ? target.dataset.audiencePath
        : undefined;

      pushProjectFinderEvent(eventName, {
        ...(direction ? { project_direction: direction } : {}),
        ...(priorities.length ? { project_priorities: priorities } : {}),
        ...(selectedProject ? { selected_project: selectedProject } : {}),
        ...(audiencePath ? { audience_path: audiencePath } : {}),
        ...(target.dataset.sourceComponent
          ? { source_component: target.dataset.sourceComponent }
          : {}),
        ...(Number.isFinite(stepNumber) ? { step_number: stepNumber } : {}),
      });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [consent.analytics]);

  return null;
}
