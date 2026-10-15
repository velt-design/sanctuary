'use client';
import { useSyncExternalStore } from 'react';
import { landingPriceTableStore } from '../../lib/landingPriceTableStore';
import { lookupLandingPrice } from '../../lib/landingPriceTable';
import type { useLandingSelection } from './useLandingSelection';

export type LandingSelectionState = Pick<ReturnType<typeof useLandingSelection>, 'ready' | 'resume' | 'type' | 'selection' | 'design' | 'failed' | 'retry'> & Partial<ReturnType<typeof useLandingSelection>>;
export function useLandingPrice(state: LandingSelectionState) {
  const snapshot = useSyncExternalStore(landingPriceTableStore.subscribe, landingPriceTableStore.getSnapshot, landingPriceTableStore.getServerSnapshot);
  // Full saved drafts always use the canonical calculation, even if their visible dimensions match a basic cell.
  const price = state.ready && !state.resume && snapshot.status === 'ready' && snapshot.table && snapshot.expiresAt > Date.now()
    ? lookupLandingPrice(snapshot.table, state.type, state.selection) : null;
  return { price, epoch: snapshot.epoch, retry: landingPriceTableStore.retry };
}
