'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_PREVIEW_DRAFT, parsePreviewDraft, PREVIEW_DRAFT_KEY, type PreviewDraft } from './previewDraft';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';

type Snapshot = { draft: PreviewDraft; storageAvailable: boolean };
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
  if (!snapshot) restore();
  return snapshot;
}
const getServerSnapshot = () => null;

function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) { restore(); emit(); }
}
function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener('pageshow', onPageShow);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('pageshow', onPageShow);
  };
}

function update(patch: { input?: SimpleCoverInput; roof?: PreviewRoofChoices }) {
  const draft = parsePreviewDraft({ ...(getSnapshot()?.draft ?? DEFAULT_PREVIEW_DRAFT), ...patch });
  if (!draft) return;
  let storageAvailable = true;
  try { window.sessionStorage.setItem(PREVIEW_DRAFT_KEY, JSON.stringify(draft)); }
  catch { storageAvailable = false; }
  // Publish and save synchronously so immediate navigation cannot lose the last edit.
  snapshot = { draft, storageAvailable };
  emit();
}

const setInput = (input: SimpleCoverInput) => update({ input });
const setRoof = (roof: PreviewRoofChoices) => update({ roof });

export function usePreviewDraft() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...(current?.draft ?? DEFAULT_PREVIEW_DRAFT), ready: current !== null,
    storageAvailable: current?.storageAvailable ?? true, setInput, setRoof };
}
