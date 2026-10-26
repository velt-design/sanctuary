'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useConfiguratorPrice } from '../configurator-prototype/useConfiguratorPrice';
import { useReviewPrice } from '../configurator-prototype/useReviewPrice';
import { enquiryEstimate } from '../../app/design-enquiry/enquiryEstimate';
import { productSelectionDraft, type ProductSelection } from './productSelection';
import type { ProductDesignType } from './productDesigns';
import { landingPriceTableStore } from '../../lib/landingPriceTableStore';
import { landingPriceIndex, lookupLandingPrice } from '../../lib/landingPriceTable';

const noSubscription = () => () => {};

/** Shared example-price wiring; approval and display policy stay in their existing owners. */
export function useProductExampleEstimate(type: ProductDesignType, selection: ProductSelection, ready = true) {
  const { draft, issue } = useMemo(() => productSelectionDraft(selection, type), [selection, type]);
  const [attempt, setAttempt] = useState(0);
  // Table cells are generated from this same basic product-selection draft.
  // Full designer extras and alternative orientations keep their canonical path.
  const compatible = ready && !issue && landingPriceIndex(type, selection) !== null;
  const table = useSyncExternalStore(compatible ? landingPriceTableStore.subscribe : noSubscription,
    compatible ? landingPriceTableStore.getSnapshot : landingPriceTableStore.getServerSnapshot,
    landingPriceTableStore.getServerSnapshot);
  const tablePrice = compatible && table.status === 'ready' && table.table && table.expiresAt > Date.now()
    ? lookupLandingPrice(table.table, type, selection) : null;
  const fallback = ready && !issue && (!compatible || table.status === 'disabled' || table.status === 'unavailable' || tablePrice?.status === 'issue');
  const { price, retry } = useConfiguratorPrice(draft, fallback, table.epoch);
  const review = useReviewPrice(draft.input, draft.roof, ready && !issue, attempt);
  const estimate: ReturnType<typeof enquiryEstimate> = issue ? { message: 'Estimate unavailable', retry: true } : tablePrice?.status === 'priced'
    ? { amount: tablePrice.amountIncGst, breakdown: [], draft: false, excluded: [] as string[] }
    : tablePrice?.status === 'custom' ? { message: 'Your design needs a tailored quote.' }
      : enquiryEstimate(fallback ? price : null, review, process.env.NODE_ENV === 'development');
  return { draft, issue, estimate, complete: 'amount' in estimate && !estimate.excluded?.length,
    retry: () => { landingPriceTableStore.retry(); retry(); setAttempt(n => n + 1); } };
}
