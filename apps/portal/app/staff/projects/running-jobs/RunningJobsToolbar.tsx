'use client';
import type { RunningJobsResponse } from '@/lib/runningJobs/types';
import { Button } from '@/components/ui/foundation/FoundationControls';
import styles from '@/components/spreadsheet/spreadsheet.module.css';
export type RunningJobsFilters = {
  search: string;
  year: string;
  crewId: string;
  stage: string;
  overdueOnly: boolean;
  showCompleted: boolean;
};

export const DEFAULT_RUNNING_JOBS_FILTERS: RunningJobsFilters = {
  search: '',
  year: 'all',
  crewId: 'all',
  stage: 'all',
  overdueOnly: false,
  showCompleted: false,
};

export default function RunningJobsToolbar({
  filters,
  onChange,
  years,
  crews,
  stages,
  totalRows,
  visibleRows,
  generatedAt,readState,onRetry,
}: {
  filters: RunningJobsFilters;
  onChange: (patch: Partial<RunningJobsFilters>) => void;
  years: string[];
  crews: RunningJobsResponse['lookups']['crews'];
  stages: string[];
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

      <select className={styles.toolbarSelect} value={filters.crewId} onChange={(event) => onChange({ crewId: event.target.value })}>
        <option value="all">All crews</option>
        {crews.map((crew) => (
          <option key={crew.id} value={crew.id}>
            {crew.shortCode ?? crew.name}
          </option>
        ))}
      </select>

      <select className={styles.toolbarSelect} value={filters.stage} onChange={(event) => onChange({ stage: event.target.value })}>
        <option value="all">All stages</option>
        {stages.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
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
          {readState?readState==='pending'?'Reading jobs…':'Jobs unavailable':`${visibleRows} of ${totalRows} jobs`}
        </span>
        <span>{generatedAt ? `Generated ${generatedAt.replace('T', ' ').slice(0, 16)}` : readState==='unavailable'?'Read unavailable':'Reading…'}</span>
      </div>
      {readState==='unavailable'&&<Button variant="secondary" onClick={onRetry}>Retry running jobs</Button>}
    </div>
  );
}
