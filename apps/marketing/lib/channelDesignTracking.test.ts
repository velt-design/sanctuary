// @vitest-environment-options {"url":"https://www.sanctuarypergolas.co.nz/"}
import { beforeEach, expect, it, vi } from 'vitest';
import { isChannelDesignPath, trackChannelAction } from './channelDesignTracking';
import { isAdLandingPath, isGoogleFunnelPath, isMetaFunnelPath } from './googleFunnel';
const send = vi.fn();
beforeEach(() => {
  sessionStorage.clear(); send.mockReset(); vi.stubGlobal('gtag', send);
  window.history.replaceState({}, '', '/ads/outdoor-living');
});

it.each(['/custom-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/aluminium-pergolas-auckland', '/ads/outdoor-living', '/ads/acrylic-pergolas', '/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas', '/pergolas-auckland', '/acrylic-roof-pergolas-auckland', '/auckland-outdoor-living'])('shares deliberate actions between surfaces on %s without leaking values', path => {
  window.history.replaceState({}, '', `${path}?utm_campaign=private-text`);
  expect(isChannelDesignPath(path)).toBe(true);
  expect(trackChannelAction('design_start', true)).toBe(true);
  expect(trackChannelAction('design_start', true, 'full_designer')).toBe(false);
  expect(trackChannelAction('design_review', true, 'full_designer')).toBe(true);
  expect(trackChannelAction('design_review', true)).toBe(false);
  expect(trackChannelAction('design_enquiry_open', true)).toBe(true);
  expect(trackChannelAction('quote', true)).toBe(true);
  expect(send.mock.calls.map(call => call[1])).toEqual(['design_start', 'design_review', 'design_enquiry_open', 'journey_decision_click']);
  expect(send.mock.calls[0][2]).toMatchObject({ source_path: path, source_surface: 'inline', configured_design: true, design_funnel_version: 'v1' });
  expect(send.mock.calls.at(-1)?.[2]).toMatchObject({ decision_action: 'help' });
  expect(JSON.stringify(send.mock.calls)).not.toContain('private-text');
});

it('consumes denied actions without backfill and rejects unknown/private paths', () => {
  expect(trackChannelAction('design_start', false)).toBe(false);
  expect(trackChannelAction('design_start', true)).toBe(false);
  expect(trackChannelAction('design_review', true)).toBe(true);
  for (const path of ['/ads/facebook/unknown', '/staff', '/quote/private', '/ads/outdoor-living?staff_project=private']) {
    window.history.replaceState({}, '', path);
    expect(trackChannelAction('design_enquiry_open', true)).toBe(false);
  }
  expect(send).toHaveBeenCalledTimes(1);
});

it('retains exact SEO source through standalone designer/enquiry and rejects invented or repeated sources', () => {
  window.history.replaceState({}, '', '/pergolas-auckland');
  expect(trackChannelAction('design_start', true)).toBe(true);
  window.history.replaceState({}, '', '/configurator-preview?source_path=%2Fpergolas-auckland&design_scope=pergolas-auckland#design=private');
  expect(trackChannelAction('design_start', true, 'full_designer')).toBe(false);
  expect(trackChannelAction('design_review', true, 'full_designer')).toBe(true);
  window.history.replaceState({}, '', '/design-enquiry?source_path=%2Fpergolas-auckland');
  expect(trackChannelAction('design_enquiry_open', true, 'full_designer')).toBe(true);
  expect(send.mock.calls.every(call => call[2].source_path === '/pergolas-auckland')).toBe(true);
  for (const path of ['/configurator-preview?source_path=/staff', '/configurator-preview?source_path=/ads/outdoor-living&source_path=/pergolas-auckland', '/contact?source_path=/ads/outdoor-living']) {
    window.history.replaceState({}, '', path);
    expect(trackChannelAction('design_review', true)).toBe(false);
  }
});

it('generic quote intent makes no claim about attached design state', () => {
  expect(trackChannelAction('quote', true)).toBe(true);
  expect(send.mock.calls[0][1]).toBe('journey_decision_click');
  expect(send.mock.calls[0][2]).not.toHaveProperty('configured_design');
});

it.each(['/aluminium-pergolas-auckland', '/custom-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds'])('keeps %s an SEO source through the full designer without classifying it as an advertisement', path => {
  expect(isAdLandingPath(path)).toBe(false);
  expect(isGoogleFunnelPath(path)).toBe(false);
  expect(isMetaFunnelPath(path)).toBe(false);
  window.history.replaceState({}, '', path);
  expect(trackChannelAction('design_start', true)).toBe(true);
  window.history.replaceState({}, '', `/configurator-preview?source_path=${encodeURIComponent(path)}&design_scope=pergolas-auckland`);
  expect(trackChannelAction('design_start', true, 'full_designer')).toBe(false);
  expect(trackChannelAction('design_review', true, 'full_designer')).toBe(true);
  expect(send.mock.calls.every(call => call[2].source_channel === 'seo' && call[2].source_path === path)).toBe(true);
});
