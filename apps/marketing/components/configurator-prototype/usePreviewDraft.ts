'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_PREVIEW_DRAFT, parsePreviewDraft, PREVIEW_DRAFT_KEY, type PreviewDraft } from './previewDraft';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { parsePreviewShareHash } from './previewShare';
import type { SharedEstimate } from './sharedEstimate';
import { SIMPLE_COVER_HANDOFF_STORAGE_KEY } from '../../lib/simpleCoverHandoff';
import { legacySimpleDraft } from './legacySimpleDraft';
import { updateDesignContinuation } from './designContinuation';
import { isLandingDesign, LANDING_DRAFT_KEY } from './draftScope';
import { DEFAULT_ROOF_FINISH } from '@sp/geometry';
import { inlineFunnelDraftKey, isInlineFunnelPath } from '../../lib/googleFunnel';

type Snapshot = { draft: PreviewDraft; storageAvailable: boolean; linkNotice?: 'loaded' | 'invalid'; sharedEstimate?: SharedEstimate | null; selectionNotice?:string };
let snapshot: Snapshot | null = null;
let activeKey = PREVIEW_DRAFT_KEY;
const snapshots = new Map<string, Snapshot | null>();
function storageKey() {
  const key = isInlineFunnelPath(window.location.pathname) ? inlineFunnelDraftKey(window.location.pathname, PREVIEW_DRAFT_KEY)
    : isLandingDesign(window.location.pathname, window.location.search) ? LANDING_DRAFT_KEY : PREVIEW_DRAFT_KEY;
  if (key !== activeKey) {
    snapshots.set(activeKey, snapshot);
    activeKey = key;
    snapshot = snapshots.get(key) ?? null;
  }
  return key;
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

function restore(fallback = DEFAULT_PREVIEW_DRAFT) {
  const key = storageKey();
  if (isInlineFunnelPath(window.location.pathname)) {
    const material = ['/ads/outdoor-living', '/auckland-outdoor-living'].includes(window.location.pathname) ? 'solid' : 'acrylic';
    fallback = { ...DEFAULT_PREVIEW_DRAFT, input: { ...DEFAULT_PREVIEW_DRAFT.input, connection: 'fascia' }, roof: { ...DEFAULT_PREVIEW_DRAFT.roof, family: 'gable',
      finish: { ...DEFAULT_ROOF_FINISH, material, ...(material === 'solid' ? { ceiling: 'thermopine-150' } : {}) } } };
  }
  // A failed write leaves the in-memory draft newer than any saved value.
  if (snapshot?.storageAvailable === false) return;
  try {
    let raw = window.sessionStorage.getItem(key);
    if (!raw) { try { raw = window.localStorage.getItem(key); } catch { /* Session-only browser. */ } }
    let draft: PreviewDraft | null = null;
    let migratedSimple = false;
    try { draft = raw ? parsePreviewDraft(JSON.parse(raw)) : null; }
    catch { /* A malformed saved draft falls back to the current defaults. */ }
    if (!draft && key === PREVIEW_DRAFT_KEY) {
      try {
        const legacy = window.sessionStorage.getItem(SIMPLE_COVER_HANDOFF_STORAGE_KEY);
        draft = legacy ? legacySimpleDraft(JSON.parse(legacy)) : null;
        migratedSimple = draft !== null;
      } catch { /* Invalid legacy data must not prevent a new design. */ }
    }
    snapshot = { draft: draft ?? fallback, storageAvailable: true,
      ...(migratedSimple ? {selectionNotice:'Your saved Simple cover dimensions are loaded. Your estimate is recalculated using current pricing.'} : {}) };
  } catch {
    // Preserve in-memory editing when browser storage is blocked.
    snapshot = { draft: snapshot?.draft ?? fallback, storageAvailable: false };
  }
}

function getSnapshot() {
  storageKey();
  return snapshot;
}
const getServerSnapshot = () => null;

function save(draft: PreviewDraft) {
  const key = storageKey();
  let storageAvailable = true;
  try { window.sessionStorage.setItem(key, JSON.stringify(draft)); }
  catch { storageAvailable = false; }
  try { window.localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Session storage remains usable. */ }
  snapshot = { draft, storageAvailable };
}

function importLink() {
  if (!window.location.hash.startsWith('#design=')) return;
  const shared = parsePreviewShareHash(window.location.hash);
  const draft = shared?.draft;
  if (draft) { save(draft); updateDesignContinuation({ started: true }); }
  if (snapshot) snapshot = { ...snapshot, linkNotice: draft ? 'loaded' : 'invalid', sharedEstimate: shared?.estimate };
  // Consume once: later edits/refresh must not replay the original shared design.
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

function onHashChange() { importLink(); emit(); }
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) { restore(); importLink(); emit(); }
}
function subscribe(listener: () => void) {
  storageKey();
  if (!snapshot) restore();
  importLink();
  if (!listeners.size) {
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('hashchange', onHashChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('hashchange', onHashChange);
    }
  };
}

function update(patch: { input?: SimpleCoverInput; roof?: PreviewRoofChoices }) {
  const requested={ ...(getSnapshot()?.draft ?? DEFAULT_PREVIEW_DRAFT), ...patch };
  const draft = parsePreviewDraft(requested);
  if (!draft) return;
  if (JSON.stringify(draft) !== JSON.stringify(getSnapshot()?.draft ?? DEFAULT_PREVIEW_DRAFT)) {
    updateDesignContinuation({ started: true });
  }
  // Publish and save synchronously so immediate navigation cannot lose the last edit.
  save(draft);
  if(snapshot && (requested.roof.blinds?.length??0)>(draft.roof.blinds?.length??0)) snapshot.selectionNotice='Some blinds no longer fit the updated openings and were removed. Choose the new openings under Outdoor blinds.';
  if(snapshot && (requested.roof.sidePanels?.length??0)>(draft.roof.sidePanels?.length??0)) snapshot.selectionNotice='Some fixed sides no longer fit the updated openings and were removed. Choose a new opening under sides.';
  if(snapshot&&requested.roof.lighting){const a=requested.roof.lighting,b=draft.roof.lighting;if(b&&(a.strips.length>b.strips.length||a.rafterCount>b.rafterCount||a.cedarCount>b.cedarCount))snapshot.selectionNotice='Some lights no longer fit the updated roof. Review your lighting layout.';}
  emit();
}

const setInput = (input: SimpleCoverInput) => update({ input });
const setRoof = (roof: PreviewRoofChoices) => update({ roof });

export function resetPreviewDraft() {
  save(DEFAULT_PREVIEW_DRAFT);
  updateDesignContinuation({ started: false, section: 'structure' });
  emit();
}

export function retainPreviewDraft() {
  const key = storageKey();
  const draft = snapshot?.draft;
  if (draft) { try { window.localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Optional cross-visit recovery. */ } }
}

/** Context is a first-visit starting point, never a replacement for saved work. */
export function initializeLandingPreview(material: 'acrylic' | 'solid') {
  if (storageKey() !== PREVIEW_DRAFT_KEY || snapshot) return;
  restore({ ...DEFAULT_PREVIEW_DRAFT, roof: { ...DEFAULT_PREVIEW_DRAFT.roof, family: 'gable',
    finish: { ...DEFAULT_ROOF_FINISH, material, ...(material === 'solid' ? { ceiling: 'thermopine-150' } : {}) } } });
  if (snapshot) save((snapshot as Snapshot).draft);
  emit();
}

export function usePreviewDraft() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...(current?.draft ?? DEFAULT_PREVIEW_DRAFT), ready: current !== null,
    storageAvailable: current?.storageAvailable ?? true, linkNotice: current?.linkNotice, sharedEstimate: current?.sharedEstimate, selectionNotice:current?.selectionNotice, setInput, setRoof };
}
