'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { runningJobsQueryOptions } from '@/lib/queries/runningJobs';
import { RUNNING_JOBS_COLUMNS } from '@/lib/runningJobs/columns';
import type { RunningJobCellKey, RunningJobRow } from '@/lib/runningJobs/types';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { useToast } from '@/components/ui/toast/ToastProvider';
import styles from './running-jobs.module.css';

function formatCellValue(row: RunningJobRow, key: RunningJobCellKey): string {
  const value = row.cells[key];
  if (typeof value === 'boolean') return value ? 'Yes' : '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value;
  return value ?? '';
}

function countRows(groups: Array<{ year: number; rows: RunningJobRow[] }>): number {
  return groups.reduce((sum, group) => sum + group.rows.length, 0);
}

function buildBlindsGroups(groups: Array<{ year: number; rows: RunningJobRow[] }>): Array<{ year: number; rows: RunningJobRow[] }> {
  return groups
    .map((group) => ({
      year: group.year,
      rows: group.rows.filter((row) => row.cells.blinds_status === 'Yes'),
    }))
    .filter((group) => group.rows.length > 0);
}

function stickyLeftFor(columnIndex: number): number {
  let left = 0;
  for (let index = 0; index < columnIndex; index += 1) {
    const column = RUNNING_JOBS_COLUMNS[index];
    if (column?.frozen) left += column.widthPx;
  }
  return left;
}

function RunningJobsTable({ groups }: { groups: Array<{ year: number; rows: RunningJobRow[] }> }) {
  if (!groups.length) {
    return <div className={styles.emptyTable}>No matching jobs.</div>;
  }

  return (
    <div className={styles.tableScroller}>
      <table className={styles.table}>
        <colgroup>
          {RUNNING_JOBS_COLUMNS.map((column) => (
            <col key={column.key} style={{ width: column.widthPx }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {RUNNING_JOBS_COLUMNS.map((column, index) => (
              <th
                key={column.key}
                className={`${styles.headerCell} ${column.frozen ? styles.frozenCell : ''}`}
                style={column.frozen ? { left: stickyLeftFor(index) } : undefined}
                scope="col"
              >
                <span className={styles.headerLetter}>{column.letter}</span>
                <span className={styles.headerLabel}>{column.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.year}>
            <tr>
              <th className={styles.yearRow} colSpan={RUNNING_JOBS_COLUMNS.length} scope="rowgroup">
                {group.year}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.projectId}>
                {RUNNING_JOBS_COLUMNS.map((column, index) => {
                  const text = formatCellValue(row, column.key);
                  const isFrozen = Boolean(column.frozen);
                  const cellClassName = [
                    styles.bodyCell,
                    isFrozen ? styles.frozenCell : '',
                    column.kind === 'notes' ? styles.notesCell : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  if (column.key === 'client_name') {
                    return (
                      <td key={column.key} className={cellClassName} style={isFrozen ? { left: stickyLeftFor(index) } : undefined}>
                        <Link className={styles.projectLink} href={`/staff/projects/${encodeURIComponent(row.projectId)}`}>
                          {text || 'Untitled'}
                        </Link>
                      </td>
                    );
                  }

                  return (
                    <td key={column.key} className={cellClassName} style={isFrozen ? { left: stickyLeftFor(index) } : undefined}>
                      {text || <span className={styles.muted}>-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export default function RunningJobsClient() {
  const toast = useToast();
  const host = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const query = useQuery(runningJobsQueryOptions(host));

  useEffect(() => {
    if (!query.error) return;
    const message = query.error instanceof Error ? query.error.message : 'Failed to load running jobs.';
    toast.error(message);
  }, [query.error, toast]);

  const groups = query.data?.groups ?? [];
  const blindsGroups = buildBlindsGroups(groups);
  const totalRows = countRows(groups);
  const totalBlindRows = countRows(blindsGroups);

  return (
    <main className={styles.page}>
      <PageHeader title="Running Jobs" />

      <div className={styles.stack}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Live Sheet</h2>
              <p className={styles.sectionCopy}>
                Read-only scaffold for the running-job list. Schedule remains authoritative for start date, crew, completion, and install days.
              </p>
            </div>
            <div className={styles.meta}>
              <span>{totalRows} jobs</span>
              <span>{totalBlindRows} with blinds</span>
              <span>{query.data?.generatedAt ? `Generated ${query.data.generatedAt.replace('T', ' ').slice(0, 16)}` : 'Loading...'}</span>
            </div>
          </div>

          {query.isLoading && !query.data ? (
            <div className={styles.emptyState}>Loading running jobs…</div>
          ) : query.error && !query.data ? (
            <div className={styles.emptyState}>Could not load running jobs.</div>
          ) : (
            <RunningJobsTable groups={groups} />
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Blinds To Install</h2>
              <p className={styles.sectionCopy}>Subset view of active jobs whose latest estimate includes meaningful blind items.</p>
            </div>
          </div>
          <RunningJobsTable groups={blindsGroups} />
        </section>
      </div>
    </main>
  );
}
