'use client';

import { useEffect } from 'react';
import { useConsent } from '@/components/ConsentProvider';

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

export default function HomepageInteractionTracker() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent.analytics) return;

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const trigger = event.target.closest<HTMLElement>('[data-homepage-event]');
      const clickedLink = event.target.closest<HTMLAnchorElement>('a[href]');
      const eventName = trigger?.dataset.homepageEvent;
      if (!trigger || !clickedLink || !eventName) return;

      const destination = clickedLink.getAttribute('href');
      const trackingWindow = window as TrackingWindow;
      trackingWindow.dataLayer = trackingWindow.dataLayer || [];
      trackingWindow.dataLayer.push({
        event: eventName,
        homepage_variant: 'v2',
        ...(destination ? { destination } : {}),
        ...(trigger.dataset.homepageItem ? { item: trigger.dataset.homepageItem } : {}),
      });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [consent.analytics]);

  return null;
}
