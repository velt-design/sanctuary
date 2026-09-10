'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_PREVIEW_DRAFT, parsePreviewDraft, PREVIEW_DRAFT_KEY, type PreviewDraft } from './previewDraft';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { parsePreviewDesign } from './previewShare';

type Snapshot = { draft: PreviewDraft; storageAvailable: boolean; linkNotice?: 'loaded' | 'invalid'; selectionNotice?:string };
let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

function restore() {
  // A failed write leaves the in-memory draft newer than any saved value.
  if (snapshot?.storageAvailable === false) return;
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_DRAFT_KEY);
    let draft: PreviewDraft | null = null;
    try { draft = raw ? parsePreviewDraft(JSON.parse(raw)) : null; }
    catch { /* A malformed saved draft falls back to the current defaults. */ }
    snapshot = { draft: draft ?? DEFAULT_PREVIEW_DRAFT, storageAvailable: true };
  } catch {
    // Preserve in-memory editing when browser storage is blocked.
    snapshot = { draft: snapshot?.draft ?? DEFAULT_PREVIEW_DRAFT, storageAvailable: false };
  }
}

function getSnapshot() {
  return snapshot;
}
const getServerSnapshot = () => null;

function save(draft: PreviewDraft) {
  let storageAvailable = true;
  try { window.sessionStorage.setItem(PREVIEW_DRAFT_KEY, JSON.stringify(draft)); }
  catch { storageAvailable = false; }
  snapshot = { draft, storageAvailable };
}

function importLink() {
  if (!window.location.hash.startsWith('#design=')) return;
  const draft = parsePreviewDesign(window.location.hash.slice(8));
  if (draft) save(draft);
  if (snapshot) snapshot = { ...snapshot, linkNotice: draft ? 'loaded' : 'invalid' };
  // Consume once: later edits/refresh must not replay the original shared design.
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

function onHashChange() { importLink(); emit(); }
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) { restore(); importLink(); emit(); }
}
function subscribe(listener: () => void) {
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
  // Publish and save synchronously so immediate navigation cannot lose the last edit.
  save(draft);
  if(snapshot && (requested.roof.blinds?.length??0)>(draft.roof.blinds?.length??0)) snapshot.selectionNotice='Some blinds no longer fit the updated openings and were removed. Choose the new openings under Outdoor blinds.';
  if(snapshot && (requested.roof.sidePanels?.length??0)>(draft.roof.sidePanels?.length??0)) snapshot.selectionNotice='Some fixed sides no longer fit the updated openings and were removed. Choose a new opening under sides.';
  emit();
}

const setInput = (input: SimpleCoverInput) => update({ input });
const setRoof = (roof: PreviewRoofChoices) => update({ roof });

export function usePreviewDraft() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...(current?.draft ?? DEFAULT_PREVIEW_DRAFT), ready: current !== null,
    storageAvailable: current?.storageAvailable ?? true, linkNotice: current?.linkNotice, selectionNotice:current?.selectionNotice, setInput, setRoof };
}
