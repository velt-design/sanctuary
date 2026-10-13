'use client';
import { useEffect, useState } from 'react';
import { INITIAL_PRODUCT_SELECTION, parseProductSelection, type ProductSelection } from '@/components/products/productSelectionValues';
import { isProductDesignType, type ProductDesignType } from '@/components/products/productDesigns';
import { LANDING_DRAFT_KEY, type LandingSourcePath } from '@/components/configurator-prototype/draftScope';
import type { LandingDesign } from './landingDesign.server';

const KEY = 'sanctuary.pergolas-auckland-selection.v1';
export function useLandingSelection(sourcePath: LandingSourcePath = '/pergolas-auckland') {
  const [type, setType] = useState<ProductDesignType>('pitched');
  const [selection, setSelection] = useState(INITIAL_PRODUCT_SELECTION);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [savedDraft, setSavedDraft] = useState<unknown>(null);
  const [otherDraft, setOtherDraft] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; design: LandingDesign | null } | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
      if (stored && isProductDesignType(stored.type)) {
        const parsed = parseProductSelection(stored.selection);
        if (parsed) { setSelection(parsed); setType(stored.type); }
      }
      if (!stored?.explore) setSavedDraft(JSON.parse(sessionStorage.getItem(LANDING_DRAFT_KEY) ?? localStorage.getItem(LANDING_DRAFT_KEY) ?? 'null'));
      setOtherDraft(Boolean(sessionStorage.getItem('sanctuary.configurator-preview.v1') ?? localStorage.getItem('sanctuary.configurator-preview.v1')));
    } catch { setStorageAvailable(false); }
    setReady(true);
  }, []);
  const key = JSON.stringify({ type, selection, savedDraft, sourcePath });
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/pergola-selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: controller.signal });
        const design = response.ok ? await response.json() as LandingDesign : null;
        if (!controller.signal.aborted) {
          if (savedDraft && design && !design.restored) { setSavedDraft(null); setRecovery('Your saved exploration could not be restored. Choose a new starting design below.'); }
          setResult({ key, design });
        }
      } catch { if (!controller.signal.aborted) setResult({ key, design: null }); }
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, ready, attempt, savedDraft]);
  function update(nextType: ProductDesignType, patch: Partial<ProductSelection> = {}) {
    const next = parseProductSelection({ ...selection, ...patch });
    if (!next) return;
    setSelection(next); setType(nextType);
    try { sessionStorage.setItem(KEY, JSON.stringify({ type: nextType, selection: next, explore: true })); } catch { setStorageAvailable(false); }
  }
  function rememberMode(explore: boolean) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ type, selection, explore })); } catch { setStorageAvailable(false); }
  }
  return { type, selection, update, ready, storageAvailable, otherDraft, recovery,
    design: result?.key === key ? result.design : null,
    failed: result?.key === key && !result.design,
    resume: Boolean(savedDraft), explore: () => { setSavedDraft(null); rememberMode(true); },
    continueDesign: () => rememberMode(false),
    retry: () => { setResult(null); setAttempt(n => n + 1); } };
}
