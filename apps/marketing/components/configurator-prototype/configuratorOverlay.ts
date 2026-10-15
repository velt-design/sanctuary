import { isGoogleFunnelPath } from '../../lib/googleFunnel';
import { isLandingDesign, withLandingDesignScope } from './draftScope';
import { parseEnquiryContext, buildEnquiryHref } from '../../lib/enquiryContext';
const SOURCE_KEY = 'sanctuary.configurator-source.v1';
export const OPEN_CONFIGURATOR_EVENT = 'sanctuary:open-configurator';
export function openConfigurator(href: string) {
  rememberConfiguratorSource(href);
  window.dispatchEvent(new CustomEvent(OPEN_CONFIGURATOR_EVENT, { detail: href }));
}

export function rememberConfiguratorSource(href: string) {
  // Editing an enquiry continues the same journey; keep its original source.
  if (window.location.pathname === '/design-enquiry') return;
  const url = new URL(href, window.location.origin);
  const context = parseEnquiryContext(Object.fromEntries(url.searchParams));
  if (!context.sourcePath) context.sourcePath = window.location.pathname;
  const scoped = isLandingDesign(url.pathname, url.search) || isLandingDesign(window.location.pathname, window.location.search);
  const query = (scoped ? withLandingDesignScope(buildEnquiryHref(context)) : buildEnquiryHref(context)).split('?')[1]?.split('#')[0] ?? '';
  try { window.sessionStorage.setItem(SOURCE_KEY, query); } catch { /* Attribution is best effort. */ }
}

export function designEnquiryHref() {
  const current = new URL(window.location.href);
  if (isGoogleFunnelPath(current.pathname)) return `${current.pathname}#project-details`;
  let query = '';
  try { query = window.sessionStorage.getItem(SOURCE_KEY) ?? ''; } catch { /* Keep enquiry available. */ }
  if (current.searchParams.has('source_path')) query = current.searchParams.toString();
  const context = parseEnquiryContext(Object.fromEntries(new URLSearchParams(query)));
  const href = buildEnquiryHref(context).replace(/^\/contact/, '/design-enquiry').split('#')[0];
  return isLandingDesign(current.pathname, current.search) || new URLSearchParams(query).get('design_scope') === 'pergolas-auckland' ? withLandingDesignScope(href) : href;
}

export function isConfiguratorEntry(url: URL, origin: string) {
  const sameScope = !url.searchParams.has('design_scope') || (typeof window !== 'undefined'
    && isLandingDesign(window.location.pathname, window.location.search) === isLandingDesign(url.pathname, url.search));
  return url.origin === origin && !url.hash && !url.searchParams.has('staff_project') && sameScope && (
    (url.pathname === '/configurator-preview' && url.searchParams.get('open') === '1') ||
    (url.pathname === '/contact' && url.searchParams.get('configurator') === 'preview')
  );
}
