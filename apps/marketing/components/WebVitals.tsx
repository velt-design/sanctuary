"use client";

import { useEffect } from 'react';
import { useConsent } from '@/components/ConsentProvider';

type GtagFn = (event: 'event', name: string, params: Record<string, unknown>) => void;

type WebVitalsMetric = {
  name: string;
  value: number;
  id: string;
};

function sendToGA(metric: WebVitalsMetric) {
  const w = window as typeof window & { gtag?: GtagFn };
  if (typeof w.gtag !== 'function') return;

  const name = metric.name;
  const value = metric.value;
  const scaled = name === 'CLS' ? Math.round(value * 1000) : Math.round(value);

  w.gtag('event', name, {
    value: scaled,
    metric_id: metric.id,
    metric_value: value,
    non_interaction: true,
    event_category: 'Web Vitals',
  });
}

export default function WebVitals() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent.analytics) return;

    let cancelled = false;
    let timerId: number | null = null;

    const start = async () => {
      try {
        const mod = await import('web-vitals');
        if (cancelled) return;

        const report = (metric: WebVitalsMetric) => sendToGA(metric);
        mod.onCLS(report);
        mod.onLCP(report);
        mod.onINP(report);
        mod.onFCP(report);
        mod.onTTFB(report);
      } catch {
        // Swallow failures so monitoring never breaks rendering.
      }
    };

    const schedule = () => {
      timerId = window.setTimeout(() => {
        void start();
      }, 2400);
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [consent.analytics]);

  return null;
}
