'use client';

import type { ReactNode } from 'react';
import { PaginationSurface } from './PaginationSurface';

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


/** Genuine page numbers and ranges are produced by the current data owner. */
export function paginationEvidence(currentPage: number, totalPages: number | null, onPageChange?: (page: number) => void, itemSummary?: ReactNode, disabled = false) {
  const safeTotal = totalPages === null ? null : Math.max(1, totalPages);
  const safeCurrent = safeTotal === null ? Math.max(1, currentPage) : Math.min(Math.max(1, currentPage), safeTotal);
  const paused = disabled || safeTotal === null;
  return {
    previousDisabled: paused || safeCurrent === 1,
    nextDisabled: paused || safeCurrent === safeTotal,
    onPrevious: () => onPageChange?.(safeCurrent - 1),
    onNext: () => onPageChange?.(safeCurrent + 1),
    itemSummary,
    numbers: (safeTotal === null ? [] : pageItems(safeCurrent, safeTotal)).map((item, index) => item === 'ellipsis' ? (
      <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
    ) : (
      <button key={item} type="button" aria-label={`Page ${item}`} aria-current={item === safeCurrent ? 'page' : undefined} disabled={paused} onClick={() => onPageChange?.(item)}>{item}</button>
    )),
  };
}

export function Pagination({ currentPage, totalPages, onPageChange, itemSummary, disabled = false, compact = false }: {
  currentPage: number;
  totalPages: number | null;
  disabled?: boolean;
  compact?: boolean;
  onPageChange?: (page: number) => void;
  itemSummary?: ReactNode;
}) {
  return <PaginationSurface compact={compact} evidence={paginationEvidence(currentPage, totalPages, onPageChange, itemSummary, disabled)} />;
}
