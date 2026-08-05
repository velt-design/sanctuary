'use client';

export type SimpleCoverFunnelEventName =
  | 'simple_calculator_view'
  | 'simple_calculator_first_interaction'
  | 'simple_calculator_result_view'
  | 'simple_calculator_cta_click'
  | 'simple_calculator_form_start';

export type SimpleCoverPlacement = 'standalone' | 'embedded';
export type SimpleCoverResultStatus = 'pending' | 'priced' | 'custom' | 'unavailable';
export type SimpleCoverSourcePath = '/simple-cover-calculator' | '/simple-pergolas-auckland';
export type SimpleCoverViewportCategory = 'mobile' | 'tablet' | 'desktop';

export type SimpleCoverFunnelProperties = {
  placement: SimpleCoverPlacement;
  result_status: SimpleCoverResultStatus;
  source_path: SimpleCoverSourcePath;
  viewport_category: SimpleCoverViewportCategory;
  calculation_attached: boolean;
};

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

const allowedEvents = new Set<SimpleCoverFunnelEventName>([
  'simple_calculator_view',
  'simple_calculator_first_interaction',
  'simple_calculator_result_view',
  'simple_calculator_cta_click',
  'simple_calculator_form_start',
]);
const allowedPlacements = new Set<SimpleCoverPlacement>(['standalone', 'embedded']);
const allowedStatuses = new Set<SimpleCoverResultStatus>(['pending', 'priced', 'custom', 'unavailable']);
const allowedSourcePaths = new Set<SimpleCoverSourcePath>([
  '/simple-cover-calculator',
  '/simple-pergolas-auckland',
]);
const allowedViewportCategories = new Set<SimpleCoverViewportCategory>([
  'mobile',
  'tablet',
  'desktop',
]);

export function getSimpleCoverViewportCategory(viewportWidth: number): SimpleCoverViewportCategory {
  if (viewportWidth <= 640) return 'mobile';
  if (viewportWidth <= 1024) return 'tablet';
  return 'desktop';
}

/**
 * Pushes the closed, non-personal Simple cover funnel contract.
 * Consent remains a caller responsibility so pre-consent activity is never queued or backfilled.
 */
export function pushSimpleCoverFunnelEvent(
  event: SimpleCoverFunnelEventName,
  properties: SimpleCoverFunnelProperties,
): boolean {
  if (
    typeof window === 'undefined'
    || !properties
    || typeof properties !== 'object'
    || !allowedEvents.has(event)
    || !allowedPlacements.has(properties.placement)
    || !allowedStatuses.has(properties.result_status)
    || !allowedSourcePaths.has(properties.source_path)
    || !allowedViewportCategories.has(properties.viewport_category)
    || typeof properties.calculation_attached !== 'boolean'
  ) {
    return false;
  }

  const trackingWindow = window as TrackingWindow;
  trackingWindow.dataLayer = trackingWindow.dataLayer || [];
  trackingWindow.dataLayer.push({
    event,
    placement: properties.placement,
    result_status: properties.result_status,
    source_path: properties.source_path,
    viewport_category: properties.viewport_category,
    calculation_attached: properties.calculation_attached,
  });
  return true;
}
