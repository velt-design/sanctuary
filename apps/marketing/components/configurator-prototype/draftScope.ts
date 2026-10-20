/** SEO planning pages share one exploration, separate from product and advertising drafts. */
export const LANDING_DRAFT_KEY = 'sanctuary.pergolas-auckland-design.v1';
export const LANDING_REDESIGN_PATH = '/pergolas-auckland/redesign';
export const LANDING_COST_PATH = '/pergola-cost-auckland';
export const LANDING_ALUMINIUM_PATH = '/aluminium-pergolas-auckland';
export type LandingSourcePath = '/pergolas-auckland' | typeof LANDING_REDESIGN_PATH | typeof LANDING_COST_PATH | typeof LANDING_ALUMINIUM_PATH;
export function landingSourcePath(value: unknown): LandingSourcePath {
  return value === LANDING_REDESIGN_PATH || value === LANDING_COST_PATH || value === LANDING_ALUMINIUM_PATH ? value : '/pergolas-auckland';
}
const LANDING_DESIGN_SCOPE = 'pergolas-auckland';
export function isLandingDesign(pathname: string, search: string) {
  if (new URLSearchParams(search).get('design_scope') === 'default') return false;
  return pathname === '/pergolas-auckland' || pathname === LANDING_REDESIGN_PATH || pathname === LANDING_COST_PATH || pathname === LANDING_ALUMINIUM_PATH
    || new URLSearchParams(search).get('design_scope') === LANDING_DESIGN_SCOPE;
}
export function withLandingDesignScope(href: string) {
  const [path, hash] = href.split('#');
  return `${path}${path.includes('?') ? '&' : '?'}design_scope=${LANDING_DESIGN_SCOPE}${hash ? `#${hash}` : ''}`;
}
