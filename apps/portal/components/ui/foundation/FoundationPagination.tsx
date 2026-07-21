'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './FoundationSurfaces.module.css';

function pageItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push('ellipsis');
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push('ellipsis');
  items.push(totalPages);
  return items;
}

export function Pagination({ currentPage, totalPages, onPageChange, itemSummary }: {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  itemSummary?: ReactNode;
}) {
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal);
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      {itemSummary ? <div className={styles.paginationSummary}>{itemSummary}</div> : null}
      <div className={styles.paginationControls}>
        <button type="button" aria-label="Previous page" onClick={() => onPageChange?.(safeCurrent - 1)} disabled={safeCurrent === 1}>
          <ChevronLeft aria-hidden="true" />
        </button>
        {pageItems(safeCurrent, safeTotal).map((item, index) => item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
        ) : (
          <button key={item} type="button" aria-label={`Page ${item}`} aria-current={item === safeCurrent ? 'page' : undefined} onClick={() => onPageChange?.(item)}>
            {item}
          </button>
        ))}
        <button type="button" aria-label="Next page" onClick={() => onPageChange?.(safeCurrent + 1)} disabled={safeCurrent === safeTotal}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
