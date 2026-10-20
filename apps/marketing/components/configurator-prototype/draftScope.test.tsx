import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { usePreviewDraft } from './usePreviewDraft';
import { PREVIEW_DRAFT_KEY } from './previewDraft';
import { isLandingDesign, LANDING_DRAFT_KEY, withLandingDesignScope } from './draftScope';
import { designEnquiryHref, isConfiguratorEntry } from './configuratorOverlay';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let current: ReturnType<typeof usePreviewDraft>;
function Probe() { current = usePreviewDraft(); return <output>{current.input.widthMm}</output>; }
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear(); localStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('keeps the prior designer draft, scoped edits and scoped enquiry independent across navigation', async () => {
  window.history.replaceState({}, '', '/configurator-preview?open=1#design=1.mono.4300.2400.ground.fascia.parallel.0');
  await act(async () => root.render(<Probe key="original"/>));
  expect(current!.input.widthMm).toBe(4300);
  const original = sessionStorage.getItem(PREVIEW_DRAFT_KEY);
  window.history.replaceState({}, '', withLandingDesignScope('/configurator-preview?open=1&source_path=%2Fpergolas-auckland#design=1.gable.7300.2800.ground.fascia.parallel.0'));
  await act(async () => root.render(<Probe key="landing"/>));
  expect(current!.input.widthMm).toBe(7300);
  await act(async () => current!.setInput({ ...current!.input, widthMm: 7400 }));
  expect(JSON.parse(sessionStorage.getItem(LANDING_DRAFT_KEY)!).input.widthMm).toBe(7400);
  expect(sessionStorage.getItem(PREVIEW_DRAFT_KEY)).toBe(original);
  expect(designEnquiryHref()).toContain('design_scope=pergolas-auckland');
  window.history.replaceState({}, '', '/design-enquiry?design_scope=pergolas-auckland');
  await act(async () => root.render(<Probe key="enquiry"/>));
  expect(current!.input.widthMm).toBe(7400);
  window.history.replaceState({}, '', '/configurator-preview?open=1&design_scope=default');
  await act(async () => root.render(<Probe key="return"/>));
  expect(current!.input.widthMm).toBe(4300);
});

it('navigates between scopes but preserves the enquiry edit overlay within the same scope', () => {
  window.history.replaceState({}, '', '/products');
  const url = new URL(withLandingDesignScope('/configurator-preview?open=1'), window.location.origin);
  expect(isConfiguratorEntry(url, window.location.origin)).toBe(false);
  window.history.replaceState({}, '', '/design-enquiry?design_scope=pergolas-auckland');
  expect(isConfiguratorEntry(url, window.location.origin)).toBe(true);
});

it('shares the exploration across both presentations while keeping an explicit default draft independent', () => {
  expect(isLandingDesign('/pergola-cost-auckland', '')).toBe(true);
  expect(isLandingDesign('/pergola-cost-auckland', '?design_scope=default')).toBe(false);
  expect(isLandingDesign('/pergola-cost-auckland/unknown', '')).toBe(false);
  expect(isLandingDesign('/pergolas-auckland/redesign', '')).toBe(true);
  expect(isLandingDesign('/pergolas-auckland/redesign', '?design_scope=default')).toBe(false);
  expect(isLandingDesign('/pergolas-auckland/unrecognised', '')).toBe(false);
  window.history.replaceState({}, '', '/configurator-preview?open=1&source_path=%2Fpergolas-auckland%2Fredesign&design_scope=pergolas-auckland');
  expect(new URL(designEnquiryHref(), window.location.origin).searchParams.get('source_path')).toBe('/pergolas-auckland/redesign');
});

it('shares the complete Auckland exploration with cost planning without losing its cost return', async () => {
  window.history.replaceState({}, '', withLandingDesignScope('/configurator-preview?open=1&source_path=%2Fpergolas-auckland#design=1.gable.5300.2800.ground.fascia.parallel.0'));
  await act(async () => root.render(<Probe key="auckland"/>));
  await act(async () => current!.setInput({ ...current!.input, level: 'elevated' }));
  window.history.replaceState({}, '', '/pergola-cost-auckland');
  await act(async () => root.render(<Probe key="cost"/>));
  expect(current!.input).toMatchObject({ widthMm: 5300, level: 'elevated' });
  window.history.replaceState({}, '', '/configurator-preview?open=1&source_path=%2Fpergola-cost-auckland&design_scope=pergolas-auckland');
  expect(new URL(designEnquiryHref(), window.location.origin).searchParams.get('source_path')).toBe('/pergola-cost-auckland');
});

it('keeps Custom SEO in the shared planning draft and returns the full design to its own enquiry', async () => {
  window.history.replaceState({}, '', withLandingDesignScope('/configurator-preview?open=1&source_path=%2Fcustom-pergolas-auckland#design=1.gable.5700.3100.ground.fascia.parallel.1'));
  await act(async () => root.render(<Probe key="custom-designer"/>));
  await act(async () => current!.setRoof({ ...current!.roof, infills: true }));
  const expected = sessionStorage.getItem(LANDING_DRAFT_KEY);
  window.history.replaceState({}, '', '/custom-pergolas-auckland');
  await act(async () => root.render(<Probe key="custom-return"/>));
  expect(current!.input).toMatchObject({ widthMm: 5700, projectionMm: 3100 });
  expect(current!.roof.infills).toBe(true);
  expect(current!.hasChosenDraft).toBe(true);
  expect(sessionStorage.getItem(LANDING_DRAFT_KEY)).toBe(expected);
  expect(designEnquiryHref()).toBe('/custom-pergolas-auckland#project-details');
  expect(isLandingDesign('/custom-pergolas-auckland-extra', '')).toBe(false);
});
