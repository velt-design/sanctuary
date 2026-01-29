'use client';

import { useEffect, useSyncExternalStore } from 'react';

type CalculatorUiPrefsState = {
  previewLayoutEnabled: boolean;
};

const STORAGE_KEY = 'sp:calculator:previewLayout';

let state: CalculatorUiPrefsState = {
  previewLayoutEnabled: false,
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CalculatorUiPrefsState {
  return state;
}

function readStoredValue(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    return raw === '1' || raw === 'true';
  } catch {
    return null;
  }
}

function writeStoredValue(next: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // ignore storage failures
  }
}

export function setPreviewLayoutEnabled(next: boolean) {
  if (state.previewLayoutEnabled === next) return;
  state = { ...state, previewLayoutEnabled: next };
  writeStoredValue(next);
  emitChange();
}

function hydrateFromStorage() {
  const stored = readStoredValue();
  if (stored === null || stored === state.previewLayoutEnabled) return;
  state = { ...state, previewLayoutEnabled: stored };
  emitChange();
}

export function useCalculatorUiPrefs(): {
  previewLayoutEnabled: boolean;
  setPreviewLayoutEnabled: (next: boolean) => void;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  return {
    previewLayoutEnabled: snapshot.previewLayoutEnabled,
    setPreviewLayoutEnabled,
  };
}

