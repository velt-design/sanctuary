'use client';
import { sendGoogleAnalyticsEvent } from './googleAnalyticsEvent';

const channels = {
  '/ads/outdoor-living': 'google', '/ads/acrylic-pergolas': 'google',
  '/ads/facebook/outdoor-living': 'facebook', '/ads/facebook/acrylic-pergolas': 'facebook',
  '/pergolas-auckland': 'seo', '/acrylic-roof-pergolas-auckland': 'seo',
  '/aluminium-pergolas-auckland': 'seo', '/custom-pergolas-auckland': 'seo',
  '/auckland-outdoor-living': 'legacy_facebook',
} as const;
type Action = 'design_start' | 'design_edit' | 'design_review' | 'design_enquiry_open' | 'quote';
type DesignSurface = 'inline' | 'full_designer';
const memory = new Set<string>();
const storageKey = 'sanctuary.channel-actions.v1';
export function isChannelDesignPath(path: string): path is keyof typeof channels {
  return Object.hasOwn(channels, path);
}

/** Only the established public continuation routes may carry a channel source. */
export function channelDesignSource(): keyof typeof channels | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search);
  if (query.has('staff_project')) return null;
  if (isChannelDesignPath(path)) return path;
  if (!['/configurator-preview', '/design-enquiry'].includes(path)) return null;
  const sources = query.getAll('source_path');
  return sources.length === 1 && isChannelDesignPath(sources[0]) ? sources[0] : null;
}

/** One action per route/tab journey, shared by inline and overlay owners.
 * Denied actions consume their marker too: consent never replays them.
 * Only closed route/action codes are stored. No draft or contact values. */
export function trackChannelAction(action: Action, allowed: boolean, surface: DesignSurface = 'inline'): boolean {
  if (typeof window === 'undefined') return false;
  const path = channelDesignSource();
  if (!path) return false;
  const key = `${path}:${action}`;
  let seen = memory;
  try { seen = new Set(JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as string[]); } catch { /* Memory remains available when storage is denied. */ }
  if (seen.has(key)) return false;
  seen.add(key); memory.add(key);
  try { sessionStorage.setItem(storageKey, JSON.stringify([...seen])); } catch { /* Tracking must never affect the journey. */ }
  if (action === 'quote') return sendGoogleAnalyticsEvent('journey_decision_click', {
    event_category: 'journey', journey_version: 'v1', decision_source: 'channel_page',
    decision_action: 'help', destination_category: 'enquiry', source_path: path,
    source_channel: channels[path], source_surface: surface,
  }, allowed);
  return sendGoogleAnalyticsEvent(action, {
    event_category: 'configured_design', design_funnel_version: 'v1', source_path: path,
    source_channel: channels[path], source_surface: surface, configured_design: true,
  }, allowed);
}
