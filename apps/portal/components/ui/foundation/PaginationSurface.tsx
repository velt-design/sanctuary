'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './FoundationSurfaces.module.css';

export type PaginationEvidence = {
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  itemSummary?: ReactNode;
  numbers: ReactNode;
};

/** The actual pager controls persist while the current owner's facts are unknown. */
export function PaginationSurface({ compact = false, evidence }: { compact?: boolean; evidence?: PaginationEvidence | null }) {
  return <nav className={styles.pagination} data-compact={compact || undefined} aria-label="Pagination">
    {compact || evidence?.itemSummary ? <div className={styles.paginationSummary}>{evidence?.itemSummary}</div> : null}
    <div className={styles.paginationControls}>
      <button type="button" aria-label="Previous page" onClick={evidence?.onPrevious} disabled={!evidence || evidence.previousDisabled}><ChevronLeft aria-hidden="true" /></button>
      {compact ? <div className={styles.paginationNumbers}>{evidence?.numbers}</div> : evidence?.numbers}
      <button type="button" aria-label="Next page" onClick={evidence?.onNext} disabled={!evidence || evidence.nextDisabled}><ChevronRight aria-hidden="true" /></button>
    </div>
  </nav>;
}
