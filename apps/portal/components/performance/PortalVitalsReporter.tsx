'use client';

import { useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import {
  PORTAL_PERFORMANCE_NAVIGATION_TYPES,
  PORTAL_WEB_VITAL_NAMES,
  PORTAL_WEB_VITAL_RATINGS,
  portalPerformanceDeviceClass,
  portalRouteTemplate,
  type PortalPerformanceNavigationType,
  type PortalWebVitalName,
  type PortalWebVitalRating,
} from '@/lib/performance/webVitals';
import { sendPortalWebVital } from '@/lib/performance/webVitalsClient';

type WebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

function navigationType(value: unknown): PortalPerformanceNavigationType {
  return typeof value === 'string' && PORTAL_PERFORMANCE_NAVIGATION_TYPES.includes(value as PortalPerformanceNavigationType)
    ? (value as PortalPerformanceNavigationType)
    : 'navigate';
}

export default function PortalVitalsReporter() {
  const pathname = usePathname();
  const { status } = usePortalSession();
  const currentContext = useRef({ pathname, status });
  currentContext.current = { pathname, status };
  const report = useCallback<WebVitalsCallback>(
    (metric) => {
      const context = currentContext.current;
      if (context.status !== 'authenticated') return;
      if (!PORTAL_WEB_VITAL_NAMES.includes(metric.name as PortalWebVitalName)) return;
      const routeTemplate = portalRouteTemplate(context.pathname);
      if (!routeTemplate) return;
      const rawRating = 'rating' in metric ? metric.rating : undefined;
      const rating = PORTAL_WEB_VITAL_RATINGS.includes(rawRating as PortalWebVitalRating)
        ? (rawRating as PortalWebVitalRating)
        : 'needs-improvement';
      sendPortalWebVital({
        name: metric.name as PortalWebVitalName,
        value: metric.value,
        rating,
        routeTemplate,
        navigationType: navigationType('navigationType' in metric ? metric.navigationType : undefined),
        deviceClass: portalPerformanceDeviceClass(window.innerWidth),
        buildId: process.env.NEXT_PUBLIC_BUILD_ID?.trim() || undefined,
      });
    },
    [],
  );
  useReportWebVitals(report);
  return null;
}
