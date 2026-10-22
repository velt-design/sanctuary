'use client';
import type { DesignPackagesResponse,DesignRequestStatus } from '@/lib/designPackages/types';
import { Button } from '@/components/ui/foundation/FoundationControls';
import styles from '@/components/spreadsheet/spreadsheet.module.css';
export type DraftingQueueFilters = {
  search: string;
  year: string;
  designerId: string;
  status: string;
  overdueOnly: boolean;
  showCompleted: boolean;
};

export const DESIGN_LIST_STATUSES: readonly DesignRequestStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
export function formatStatusLabel(value: DesignRequestStatus): string {
  return value.replace(/_/g, ' ');
}

export const DEFAULT_DRAFTING_QUEUE_FILTERS: DraftingQueueFilters = {
  search: '',
  year: 'all',
  designerId: 'all',
  status: 'all',
  overdueOnly: false,
  showCompleted: false,
};

export default function DraftingQueueToolbar({
  filters,
  onChange,
  years,
  designers,
  totalRows,
  visibleRows,
  generatedAt,readState,onRetry,
}: {
  filters: DraftingQueueFilters;
  onChange: (patch: Partial<DraftingQueueFilters>) => void;
  years: string[];
  designers: DesignPackagesResponse['lookups']['designers'];
  totalRows: number|null;
  visibleRows: number|null;
  generatedAt: string | null;readState?:'pending'|'unavailable';onRetry?:()=>void;
}) {
  return (
    <div className={styles.toolbar}>
      <input
        className={styles.toolbarInput}
        type="search"
        placeholder="Search jobs"
        value={filters.search}
        onChange={(event) => onChange({ search: event.target.value })}
      />

      <select className={styles.toolbarSelect} value={filters.year} onChange={(event) => onChange({ year: event.target.value })}>
        <option value="all">All years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <select className={styles.toolbarSelect} value={filters.designerId} onChange={(event) => onChange({ designerId: event.target.value })}>
        <option value="all">All designers</option>
        <option value="unassigned">Unassigned</option>
        {designers.map((designer) => (
          <option key={designer.id} value={designer.id}>
            {designer.label}
          </option>
        ))}
      </select>

      <select className={styles.toolbarSelect} value={filters.status} onChange={(event) => onChange({ status: event.target.value })}>
        <option value="all">All statuses</option>
        {DESIGN_LIST_STATUSES.map((status) => (
          <option key={status} value={status}>
            {formatStatusLabel(status)}
          </option>
        ))}
      </select>

      <label className={styles.toolbarToggle}>
        <input type="checkbox" checked={filters.overdueOnly} onChange={(event) => onChange({ overdueOnly: event.target.checked })} />
        <span>Overdue only</span>
      </label>

      <label className={styles.toolbarToggle}>
        <input type="checkbox" checked={filters.showCompleted} onChange={(event) => onChange({ showCompleted: event.target.checked })} />
        <span>Show completed</span>
      </label>

      <div className={styles.meta}>
        <span>
          {readState?readState==='pending'?'Reading requests…':'Requests unavailable':`${visibleRows} of ${totalRows} requests`}
        </span>
        <span>{generatedAt ? `Generated ${generatedAt.replace('T', ' ').slice(0, 16)}` : readState==='unavailable'?'Read unavailable':'Reading…'}</span>
      </div>
      {readState==='unavailable'&&<Button variant="secondary" onClick={onRetry}>Retry drafting queue</Button>}
    </div>
  );
}
