import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { legacySimpleDraft } from './legacySimpleDraft';
import { usePreviewDraft } from './usePreviewDraft';
import { PREVIEW_DRAFT_KEY, DEFAULT_PREVIEW_DRAFT } from './previewDraft';
import { SIMPLE_COVER_HANDOFF_STORAGE_KEY } from '../../lib/simpleCoverHandoff';
import { buildPreviewShareUrl } from './previewShare';

const handoff = {schemaVersion:'simple-cover-handoff.v1',status:'priced',
  input:{widthMm:5400,projectionMm:3200,level:'ground',connection:'facade'},
  calculationRef:'sc1.old-reference',displayedPriceIncGst:15000,configurationVersion:2};

it('migrates only valid unchanged selections, never an old price or signed reference', () => {
  expect(legacySimpleDraft(handoff)).toEqual({version:1,input:handoff.input,roof:DEFAULT_PREVIEW_DRAFT.roof});
  expect(legacySimpleDraft({...handoff,input:{...handoff.input,widthMm:1200}})).toBeNull();
  expect(legacySimpleDraft({...handoff,status:'invalid'})).toBeNull();
  expect(legacySimpleDraft(null)).toBeNull();
});

it('uses legacy selections only as a fallback, with newer edits and shared designs taking precedence', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/contact?configurator=preview');
  window.sessionStorage.setItem(SIMPLE_COVER_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
  const root = createRoot(document.createElement('div'));
  let current: ReturnType<typeof usePreviewDraft>;
  function Harness() { current = usePreviewDraft(); return null; }
  const restore = async () => React.act(async () => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true}));
  });
  try {
    await React.act(async () => root.render(<Harness />));
    expect(current!.input).toEqual(handoff.input);
    expect(current!.sharedEstimate).toBeUndefined();
    expect(current!.selectionNotice).toContain('recalculated using current pricing');
    await React.act(async () => current!.setInput({...current!.input,widthMm:6500}));
    await restore();
    expect(current!.input.widthMm).toBe(6500);
    const shared = {...DEFAULT_PREVIEW_DRAFT,input:{...DEFAULT_PREVIEW_DRAFT.input,widthMm:7000}};
    const sharedUrl = new URL(buildPreviewShareUrl(window.location.origin,shared));
    window.history.replaceState({}, '', sharedUrl.pathname + sharedUrl.search + sharedUrl.hash);
    await React.act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')));
    expect(current!.input.widthMm).toBe(7000);
    expect(JSON.parse(window.sessionStorage.getItem(PREVIEW_DRAFT_KEY)! ).input.widthMm).toBe(7000);
    window.sessionStorage.clear();
    window.sessionStorage.setItem(SIMPLE_COVER_HANDOFF_STORAGE_KEY,'invalid JSON');
    await restore();
    expect(current!.input).toEqual(DEFAULT_PREVIEW_DRAFT.input);
  } finally {
    await React.act(async () => root.unmount());
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  }
});
