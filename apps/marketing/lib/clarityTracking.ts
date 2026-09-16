'use client';
import { isProjectDirection } from './projectFinderContract';

// Only public browsing and enquiry routes. Private/token/staff pages fail closed.
const pages = new Set(['/', '/simple-pergolas-auckland', '/simple-cover-calculator',
  '/contact', '/design-enquiry', '/contact/thanks', '/configurator-preview', '/products', '/projects', '/gallery',
  '/pergola-guides', '/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland',
  '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland',
  '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs', '/commercial-pergolas-auckland',
  '/architects-designers-builders', '/acrylic-roof-pergolas-auckland', '/privacy']);

export function clarityPageAllowed(pathname: string, search: string): boolean {
  const query = new URLSearchParams(search);
  // Tracking URLs must not contain drafts, staff IDs, customer tokens or free text.
  const allowedKeys = new Set(['source_path', 'source_component', 'source_experience', 'enquiry_type', 'project_direction', 'request_type', 'pathway', 'configurator', 'open', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'msclkid']);
  if ([...query.keys()].some(key => !allowedKeys.has(key))) return false;
  if (query.getAll('project_direction').some(value => !isProjectDirection(value))) return false;
  return pages.has(pathname) || /^\/projects\/[a-z0-9-]+$/.test(pathname)
    || /^\/products\/[a-z0-9-]+\/[a-z0-9-]+$/.test(pathname);
}

export function clarityProjectId(value: string | undefined): string | null {
  return value && /^[a-z0-9]{6,20}$/.test(value) ? value : null;
}

export type ClarityFunction = ((...args: unknown[]) => void) & { q?: unknown[][] };
export type ClarityWindow = Window & { clarity?: ClarityFunction; sanctuaryClarityActive?: boolean };
export function callClarity(target: ClarityWindow, ...args: unknown[]): boolean {
  try { if (!target.clarity) return false; target.clarity(...args); return true; }
  catch { return false; }
}
const events = new Set(['design_start', 'design_edit', 'design_review', 'contact_start', 'contact_error', 'contact_success']);

/** No payload values, IDs, selections or text are copied into replay metadata. */
export function sendClarityJourneyEvent(event: string): void {
  const target = window as ClarityWindow;
  if (!events.has(event) || !target.sanctuaryClarityActive || !clarityPageAllowed(location.pathname, location.search)) return;
  callClarity(target, 'event', event);
}
