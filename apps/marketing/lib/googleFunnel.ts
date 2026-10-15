/** Exact campaign routes only. Existing Facebook and search journeys keep their owners. */
export const GOOGLE_FUNNEL_PATHS = ['/ads/outdoor-living', '/ads/acrylic-pergolas'] as const;
export type GoogleFunnelPath = typeof GOOGLE_FUNNEL_PATHS[number];
export function isGoogleFunnelPath(path: string | null): path is GoogleFunnelPath {
  return GOOGLE_FUNNEL_PATHS.some(value => value === path);
}
/** Shared client/API scope for the reduced residential enquiry requirements. */
export function isGoogleFunnelEnquiry(audience: string, page: string): boolean {
  return audience === 'residential' && isGoogleFunnelPath(page);
}
export function googleFunnelDraftKey(path: GoogleFunnelPath) {
  return `sanctuary.google-funnel.${path.split('/').at(-1)}.v1`;
}
export const GOOGLE_FUNNEL_ENQUIRE_EVENT = 'sanctuary:google-funnel-enquire';
export function returnToGoogleFunnelEnquiry() {
  if (!isGoogleFunnelPath(window.location.pathname)) return false;
  window.dispatchEvent(new Event(GOOGLE_FUNNEL_ENQUIRE_EVENT));
  document.querySelector<HTMLDialogElement>('dialog[open][aria-label="Design your pergola"]')?.close();
  requestAnimationFrame(() => {
    document.getElementById('project-details')?.scrollIntoView({ block: 'start' });
    document.getElementById('contact-name')?.focus({ preventScroll: true });
  });
  return true;
}
