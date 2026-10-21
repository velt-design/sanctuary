/** Exact inline-design routes. Page content and SEO stay with each page owner. */
export const GOOGLE_FUNNEL_PATHS = ['/ads/outdoor-living', '/ads/acrylic-pergolas'] as const;
export const META_FUNNEL_PATHS = ['/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas'] as const;
const OTHER_INLINE_DESIGN_PATHS = ['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland', '/aluminium-pergolas-auckland', '/custom-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds'] as const;
export type GoogleFunnelPath = typeof GOOGLE_FUNNEL_PATHS[number];
export type InlineFunnelPath = GoogleFunnelPath | typeof META_FUNNEL_PATHS[number] | typeof OTHER_INLINE_DESIGN_PATHS[number];
export function isGoogleFunnelPath(path: string | null): path is GoogleFunnelPath {
  return GOOGLE_FUNNEL_PATHS.some(value => value === path);
}
export function isMetaFunnelPath(path: string | null): path is typeof META_FUNNEL_PATHS[number] {
  return META_FUNNEL_PATHS.some(value => value === path);
}
export function isInlineFunnelPath(path: string | null): path is InlineFunnelPath {
  return isGoogleFunnelPath(path) || isMetaFunnelPath(path) || OTHER_INLINE_DESIGN_PATHS.some(value => value === path);
}
/** Ads and the legacy noindex campaign page have reduced chrome; indexed SEO keeps it. */
export function isAdLandingPath(path: string | null) {
  return isGoogleFunnelPath(path) || isMetaFunnelPath(path) || path === '/auckland-outdoor-living';
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
