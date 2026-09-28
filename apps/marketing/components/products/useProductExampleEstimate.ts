'use client';
import { useMemo, useState } from 'react';
import { useConfiguratorPrice } from '../configurator-prototype/useConfiguratorPrice';
import { useReviewPrice } from '../configurator-prototype/useReviewPrice';
import { enquiryEstimate } from '../../app/design-enquiry/enquiryEstimate';
import { productSelectionDraft, type ProductSelection } from './productSelection';
import type { ProductDesignType } from './productDesigns';

/** Shared example-price wiring; approval and display policy stay in their existing owners. */
export function useProductExampleEstimate(type: ProductDesignType, selection: ProductSelection) {
  const draft = useMemo(() => productSelectionDraft(selection, type).draft, [selection, type]);
  const [attempt, setAttempt] = useState(0);
  const { price, retry } = useConfiguratorPrice(draft, true);
  const review = useReviewPrice(draft.input, draft.roof, true, attempt);
  const estimate = enquiryEstimate(price, review, process.env.NODE_ENV === 'development');
  return { estimate, complete: 'amount' in estimate && !estimate.excluded?.length,
    retry: () => { retry(); setAttempt(n => n + 1); } };
}
