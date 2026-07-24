'use client';

import { useEffect } from 'react';
import { useConsent } from '@/components/ConsentProvider';

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

function getViewportCategory() {
  if (window.innerWidth <= 640) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

export default function HomepageInteractionTracker() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent.analytics) return;

    const pushEvent = (
      eventName: string,
      trigger: HTMLElement,
      destination?: string | null,
    ) => {
      const trackingWindow = window as TrackingWindow;
      trackingWindow.dataLayer = trackingWindow.dataLayer || [];
      trackingWindow.dataLayer.push({
        event: eventName,
        homepage_variant: 'v2',
        viewport_category: getViewportCategory(),
        ...(destination ? { destination } : {}),
        ...(trigger.dataset.homepageItem ? { item: trigger.dataset.homepageItem } : {}),
      });
    };

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const trigger = event.target.closest<HTMLElement>('[data-homepage-event]');
      const clickedLink = event.target.closest<HTMLAnchorElement>('a[href]');
      const eventName = trigger?.dataset.homepageEvent;
      if (!trigger || !eventName) return;

      pushEvent(eventName, trigger, clickedLink?.getAttribute('href'));
    };

    const handleToggle = (event: Event) => {
      if (!window.matchMedia('(max-width: 640px)').matches) return;
      if (!(event.target instanceof HTMLDetailsElement) || !event.target.open) return;

      const eventName = event.target.dataset.homepageToggleEvent;
      if (!eventName) return;
      pushEvent(eventName, event.target);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('toggle', handleToggle, true);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('toggle', handleToggle, true);
    };
  }, [consent.analytics]);

  return null;
}
