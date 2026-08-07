export const PORTAL_NAVIGATION_INTENT_EVENT = 'portal:navigation-intent';

export type PortalNavigationIntentDetail = {
  href: string;
  source: string;
};

const checkedClickEvents = new WeakSet<Event>();

/**
 * Gives editors with unsaved work one synchronous, cancelable boundary before
 * the portal replaces the current page with an exact destination frame.
 */
export function dispatchPortalNavigationIntent(
  detail: PortalNavigationIntentDetail,
  clickEvent?: Event,
): boolean {
  if (clickEvent) checkedClickEvents.add(clickEvent);
  if (typeof document === 'undefined') return true;

  return document.dispatchEvent(new CustomEvent<PortalNavigationIntentDetail>(
    PORTAL_NAVIGATION_INTENT_EVENT,
    { cancelable: true, detail },
  ));
}

export function hasCheckedPortalNavigationIntent(event: Event): boolean {
  return checkedClickEvents.has(event);
}
