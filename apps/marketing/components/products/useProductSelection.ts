'use client';
import { useEffect, useState } from 'react';
import { INITIAL_PRODUCT_SELECTION, parseProductSelection, productProjectionMax, type ProductSelection } from './productSelection';
import type { ProductDesignType } from './productDesigns';

export function useProductSelection(type: ProductDesignType = 'pitched') {
  const key = `sanctuary:${type}-product:v1`;
  const [selection, setSelection] = useState(INITIAL_PRODUCT_SELECTION);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [adjustment, setAdjustment] = useState('');
  function constrain(selection: ProductSelection) {
    const max = productProjectionMax(selection, type);
    const projectionMm = Math.min(selection.projectionMm, max);
    setAdjustment(projectionMm !== selection.projectionMm ? `Projection adjusted to ${(projectionMm / 1000).toFixed(1)} m for this roof. You can review it under Size.` : '');
    return { ...selection, projectionMm };
  }
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      const saved = raw ? parseProductSelection(JSON.parse(raw)) : null;
      const restored = saved ?? INITIAL_PRODUCT_SELECTION;
      const max = productProjectionMax(restored, type);
      setSelection({ ...restored, projectionMm: Math.min(restored.projectionMm, max) });
      if (restored.projectionMm > max) setAdjustment(`Saved projection adjusted to ${(max / 1000).toFixed(1)} m for this roof.`);
    } catch { setStorageAvailable(false); }
    setReady(true);
  }, [key, type]);
  function update(patch: Partial<ProductSelection>) {
    const requested = parseProductSelection({ ...selection, ...patch });
    if (!requested) return;
    const next = constrain(requested);
    setSelection(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { setStorageAvailable(false); }
  }
  return { selection, update, ready, storageAvailable, adjustment, projectionMax: productProjectionMax(selection, type) };
}
