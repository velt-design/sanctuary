/** Exact inline-design routes. Page content and SEO stay with each page owner. */
export const GOOGLE_FUNNEL_PATHS = ['/ads/outdoor-living', '/ads/acrylic-pergolas'] as const;
export const META_FUNNEL_PATHS = ['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland'] as const;
export type GoogleFunnelPath = typeof GOOGLE_FUNNEL_PATHS[number];
export type InlineFunnelPath = GoogleFunnelPath | typeof META_FUNNEL_PATHS[number];
export function isGoogleFunnelPath(path: string | null): path is GoogleFunnelPath {
  return GOOGLE_FUNNEL_PATHS.some(value => value === path);
}
export function isMetaFunnelPath(path: string | null): path is typeof META_FUNNEL_PATHS[number] {
  return META_FUNNEL_PATHS.some(value => value === path);
}
export function isInlineFunnelPath(path: string | null): path is InlineFunnelPath {
  return isGoogleFunnelPath(path) || isMetaFunnelPath(path);
}
/** Shared client/API scope for the reduced residential enquiry requirements. */
export function isInlineFunnelEnquiry(audience: string, page: string): boolean {
  return audience === 'residential' && isInlineFunnelPath(page);
}
/** Meta retains its existing shared customer draft; Google keeps its isolated keys. */
export function inlineFunnelDraftKey(path: InlineFunnelPath, existingDraftKey: string) {
  return isGoogleFunnelPath(path) ? googleFunnelDraftKey(path) : existingDraftKey;
}
export function googleFunnelDraftKey(path: GoogleFunnelPath) {
  return `sanctuary.google-funnel.${path.split('/').at(-1)}.v1`;
}
export const GOOGLE_FUNNEL_ENQUIRE_EVENT = 'sanctuary:google-funnel-enquire';
export function returnToInlineFunnelEnquiry() {
  if (!isInlineFunnelPath(window.location.pathname)) return false;
  window.dispatchEvent(new Event(GOOGLE_FUNNEL_ENQUIRE_EVENT));
  document.querySelector<HTMLDialogElement>('dialog[open][aria-label="Design your pergola"]')?.close();
  requestAnimationFrame(() => {
    document.getElementById('project-details')?.scrollIntoView({ block: 'start' });
    document.getElementById('contact-name')?.focus({ preventScroll: true });
  });
  return true;
}
