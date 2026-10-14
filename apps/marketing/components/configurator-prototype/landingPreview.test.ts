import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_PREVIEW_DRAFT, PREVIEW_DRAFT_KEY } from './previewDraft';
import { SIMPLE_COVER_HANDOFF_STORAGE_KEY } from '../../lib/simpleCoverHandoff';

beforeEach(() => { vi.resetModules(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState({}, '', '/auckland-outdoor-living'); });
const stored = () => JSON.parse(sessionStorage.getItem(PREVIEW_DRAFT_KEY)!);
it('starts a new timber design through the canonical draft, preserving subsequent in-memory work', async () => {
  const { initializeLandingPreview } = await import('./usePreviewDraft');
  initializeLandingPreview('solid');
  expect(stored().roof).toMatchObject({ family: 'gable', finish: { material: 'solid', ceiling: 'thermopine-150' } });
  initializeLandingPreview('acrylic');
  expect(stored().roof.finish.material).toBe('solid');
});
for (const storage of ['sessionStorage', 'localStorage'] as const) it(`preserves a valid ${storage} design`, async () => {
  window[storage].setItem(PREVIEW_DRAFT_KEY, JSON.stringify({ ...DEFAULT_PREVIEW_DRAFT, input: { ...DEFAULT_PREVIEW_DRAFT.input, widthMm: 7400 } }));
  const { initializeLandingPreview } = await import('./usePreviewDraft');
  initializeLandingPreview('solid');
  expect(stored().input.widthMm).toBe(7400);
  expect(stored().roof.family).toBe('mono');
});
it('preserves legacy Simple choices before applying a landing starting point', async () => {
  sessionStorage.setItem(SIMPLE_COVER_HANDOFF_STORAGE_KEY, JSON.stringify({ schemaVersion: 'simple-cover-handoff.v1', status: 'custom', input: { ...DEFAULT_PREVIEW_DRAFT.input, widthMm: 7300 }, calculationRef: null, displayedPriceIncGst: null, configurationVersion: null }));
  const { initializeLandingPreview } = await import('./usePreviewDraft');
  initializeLandingPreview('solid');
  expect(stored().input.widthMm).toBe(7300);
  expect(stored().roof.family).toBe('mono');
});
it('keeps the separately owned Auckland design scope unchanged', async () => {
  window.history.replaceState({}, '', '/pergolas-auckland');
  const { initializeLandingPreview } = await import('./usePreviewDraft');
  initializeLandingPreview('solid');
  expect(sessionStorage.getItem(PREVIEW_DRAFT_KEY)).toBeNull();
});
