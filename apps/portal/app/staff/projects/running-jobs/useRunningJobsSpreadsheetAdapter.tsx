'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import type { SpreadsheetAdapter } from '@/components/spreadsheet/types';
import styles from '@/components/spreadsheet/spreadsheet.module.css';
import { qk } from '@/lib/queries/keys';
import { runningJobsQueryOptions } from '@/lib/queries/runningJobs';
import { RUNNING_JOBS_COLUMNS } from '@/lib/runningJobs/columns';
import {
  applyOptimisticRunningJobCellValue,
  getRunningJobCellEditability,
  getRunningJobEditorValue,
  normalizeRunningJobCellInput,
  type NormalizedRunningJobCellValue,
} from '@/lib/runningJobs/editing';
import { compareRunningJobRows, flattenRunningJobGroups, groupRunningJobRows, updateRunningJobRowInGroups, yearForRunningJobRow } from '@/lib/runningJobs/group';
import type {
  RunningJobCellKey,
  RunningJobEditableCellKey,
  RunningJobRow,
  RunningJobsResponse,
  RunningJobStatusValue,
} from '@/lib/runningJobs/types';
import { mutateRunningJobCell } from '@/lib/repo/runningJobsRepo';
import { ApiError } from '@/lib/repo/apiClient';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

type Filters = {
  search: string;
  year: string;
  crewId: string;
  stage: string;
  overdueOnly: boolean;
  showCompleted: boolean;
};

const DEFAULT_FILTERS: Filters = {
  search: '',
  year: 'all',
  crewId: 'all',
  stage: 'all',
  overdueOnly: false,
  showCompleted: false,
};

const TODAY_YMD = new Date().toISOString().slice(0, 10);

function isLegacySheetRow(row: RunningJobRow): boolean {
  return row.source === 'legacy';
}

function formatCellValue(row: RunningJobRow, key: RunningJobCellKey): string {
  const display = row.displayTextByCell?.[key];
  if (typeof display === 'string') return display;
  const value = row.cells[key];
  if (typeof value === 'boolean') return value ? 'Y' : '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value;
  return value ?? '';
}

function searchTextForCell(row: RunningJobRow, key: RunningJobCellKey): string {
  return formatCellValue(row, key);
}

function rowYearValue(row: RunningJobRow): string {
  if (typeof row.groupYear === 'number') return String(row.groupYear);
  const estimated = row.cells.estimated_start_date?.match(/^(\d{4})/)?.[1];
  if (estimated) return estimated;
  const created = row.state.projectCreatedAt?.match(/^(\d{4})/)?.[1];
  return created ?? '';
}

function isOverdue(row: RunningJobRow): boolean {
  return Boolean(row.cells.estimated_start_date && row.cells.estimated_start_date < TODAY_YMD && !row.cells.job_completed);
}

function isInProgress(row: RunningJobRow): boolean {
  return row.state.schedule.status === 'in_progress';
}

function isCompletedRow(row: RunningJobRow): boolean {
  return row.cells.job_completed || row.stage === 'COMPLETED' || row.stage === 'PAID';
}

function promptForFinishEarly(freedDays: number): 'pull_forward' | 'keep_schedule' | null {
  if (typeof window === 'undefined') return null;
  if (window.confirm(`This job finishes ${freedDays} working day${freedDays === 1 ? '' : 's'} early.\n\nOK: pull following work forward.\nCancel: choose another option.`)) {
    return 'pull_forward';
  }
  if (window.confirm('Keep the remaining slot as a downtime buffer?\n\nOK: keep schedule buffer.\nCancel: abort the edit.')) {
    return 'keep_schedule';
  }
  return null;
}

function promptForScheduleImpacts(impacts: Array<{ before_start: string | null; after_start: string | null }>): boolean {
  if (typeof window === 'undefined') return false;
  const preview = impacts
    .slice(0, 3)
    .map((impact) => `${impact.before_start ?? 'unscheduled'} -> ${impact.after_start ?? 'unscheduled'}`)
    .join('\n');
  const suffix = impacts.length > 3 ? `\n…and ${impacts.length - 3} more change(s).` : '';
  return window.confirm(
    `This change will move ${impacts.length} scheduled job${impacts.length === 1 ? '' : 's'} in the near-term schedule.\n\n${preview}${suffix}\n\nContinue?`,
  );
}

function setInRecord(record: Record<string, boolean>, key: string, value: boolean): Record<string, boolean> {
  if (value) return { ...record, [key]: true };
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function groupRowsByFilters(groups: RunningJobsResponse['groups'], filters: Filters): RunningJobsResponse['groups'] {
  const query = filters.search.trim().toLowerCase();
  const rows = flattenRunningJobGroups(groups).filter((row) => {
    if (filters.year !== 'all' && rowYearValue(row) !== filters.year) {
      return false;
    }
    if (filters.crewId !== 'all' && row.state.schedule.crewId !== filters.crewId) return false;
    if (filters.stage !== 'all' && row.stage !== filters.stage) return false;
    if (filters.overdueOnly && !isOverdue(row)) return false;
    if (!filters.showCompleted && isCompletedRow(row)) return false;
    if (!query) return true;

    return [
      searchTextForCell(row, 'client_name'),
      searchTextForCell(row, 'phone_number'),
      searchTextForCell(row, 'site_address'),
      searchTextForCell(row, 'pergola_type'),
      searchTextForCell(row, 'running_notes'),
      searchTextForCell(row, 'job_assigned_to'),
      searchTextForCell(row, 'site_visit_rep'),
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  return groupRunningJobRows(rows);
}

function patchResponse(
  prev: RunningJobsResponse,
  projectId: string,
  updater: (row: RunningJobRow) => RunningJobRow,
): RunningJobsResponse {
  return {
    ...prev,
    generatedAt: new Date().toISOString(),
    groups: updateRunningJobRowInGroups(prev.groups, projectId, updater),
  };
}

function Toolbar({
  filters,
  onChange,
  years,
  crews,
  stages,
  totalRows,
  visibleRows,
  generatedAt,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  years: string[];
  crews: RunningJobsResponse['lookups']['crews'];
  stages: string[];
  totalRows: number;
  visibleRows: number;
  generatedAt: string | null;
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
          {visibleRows} of {totalRows} jobs
        </span>
        <span>{generatedAt ? `Generated ${generatedAt.replace('T', ' ').slice(0, 16)}` : 'Loading...'}</span>
      </div>
    </div>
  );
}

export function useRunningJobsSpreadsheetAdapter(): SpreadsheetAdapter<
  RunningJobRow,
  RunningJobCellKey,
  RunningJobEditableCellKey,
  NormalizedRunningJobCellValue
> {
  const toast = useToast();
  const queryClient = useQueryClient();
  const host = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const queryKey = qk.runningJobs.list(host);
  const query = useQuery(runningJobsQueryOptions(host));

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [conflictCells, setConflictCells] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!query.error) return;
    const message = query.error instanceof Error ? query.error.message : 'Failed to load running jobs.';
    toast.error(message);
  }, [query.error, toast]);

  const allGroups = query.data?.groups ?? [];
  const lookups = query.data?.lookups ?? { crews: [], salesPeople: [] };
  const filteredGroups = useMemo(() => groupRowsByFilters(allGroups, filters), [allGroups, filters]);
  const allRows = useMemo(() => flattenRunningJobGroups(allGroups), [allGroups]);
  const visibleRows = useMemo(() => flattenRunningJobGroups(filteredGroups), [filteredGroups]);

  const years = useMemo(
    () => Array.from(new Set(allRows.map((row) => rowYearValue(row)))).filter(Boolean).sort(),
    [allRows],
  );
  const stages = useMemo(() => Array.from(new Set(allRows.map((row) => row.stage).filter((stage) => stage !== 'LEGACY'))).sort(), [allRows]);
  const rowNumberRows = useMemo(
    () =>
      allRows
        .slice()
        .sort((a, b) => {
          const yearDiff = yearForRunningJobRow(a) - yearForRunningJobRow(b);
          if (yearDiff !== 0) return yearDiff;
          return compareRunningJobRows(a, b);
        }),
    [allRows],
  );

  const clearConflictLater = useCallback((id: string) => {
    window.setTimeout(() => {
      setConflictCells((prev) => setInRecord(prev, id, false));
    }, 4000);
  }, []);

  const persistCell = useCallback(
    async (
      row: RunningJobRow,
      key: RunningJobEditableCellKey,
      value: NormalizedRunningJobCellValue,
      options?: { force?: boolean; finishEarlyAction?: 'pull_forward' | 'keep_schedule' },
    ): Promise<boolean> => {
      const normalized = normalizeRunningJobCellInput(key, value);
      if (!normalized.ok) {
        toast.error(normalized.error);
        return false;
      }

      const editability = getRunningJobCellEditability(row, key);
      if (!editability.editable) {
        toast.error(editability.reason ?? 'This cell cannot be edited yet.');
        return false;
      }

      const id = `${row.projectId}:${key}`;
      const previous = queryClient.getQueryData<RunningJobsResponse>(queryKey);
      setSavingCells((prev) => setInRecord(prev, id, true));
      setConflictCells((prev) => setInRecord(prev, id, false));

      if (previous) {
        queryClient.setQueryData<RunningJobsResponse>(
          queryKey,
          patchResponse(previous, row.projectId, (current) => applyOptimisticRunningJobCellValue(current, key, normalized.value, lookups)),
        );
      }

      try {
        const response = await mutateRunningJobCell({
          projectId: row.projectId,
          rowVersion: row.rowVersion,
          key,
          value: normalized.value,
          force: options?.force,
          finishEarlyAction: options?.finishEarlyAction,
        });

        if ('requires_finish_early' in response) {
          if (previous) queryClient.setQueryData(queryKey, previous);
          const action = promptForFinishEarly(response.freed_days);
          if (!action) return false;
          return persistCell(row, key, normalized.value, { force: true, finishEarlyAction: action });
        }

        if ('requires_confirmation' in response) {
          if (previous) queryClient.setQueryData(queryKey, previous);
          if (!promptForScheduleImpacts(response.impacts)) return false;
          return persistCell(row, key, normalized.value, { force: true, finishEarlyAction: options?.finishEarlyAction });
        }

        queryClient.setQueryData<RunningJobsResponse>(queryKey, (current) =>
          current
            ? {
                ...current,
                generatedAt: new Date().toISOString(),
                groups: updateRunningJobRowInGroups(current.groups, response.updatedRow.projectId, () => response.updatedRow),
              }
            : current,
        );

        if (key === 'estimated_start_date' || key === 'job_assigned_to' || key === 'job_completed' || key === 'install_days') {
          void queryClient.invalidateQueries({ queryKey: qk.schedule.snapshot(host) });
        }
        void queryClient.invalidateQueries({ queryKey: qk.projects.detail(host, row.projectId) });
        void queryClient.invalidateQueries({ queryKey: qk.projects.snapshot(host, row.projectId) });
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const currentRow = (error.body as any)?.currentRow as RunningJobRow | undefined;
          if (currentRow && previous) {
            queryClient.setQueryData<RunningJobsResponse>(queryKey, {
              ...previous,
              generatedAt: new Date().toISOString(),
              groups: updateRunningJobRowInGroups(previous.groups, currentRow.projectId, () => currentRow),
            });
          } else if (previous) {
            queryClient.setQueryData(queryKey, previous);
          }
          setConflictCells((prev) => setInRecord(prev, id, true));
          clearConflictLater(id);
          toast.error('This row changed in another tab. The latest server row has been reloaded.');
          return false;
        }

        if (previous) queryClient.setQueryData(queryKey, previous);
        toast.error(error instanceof Error ? error.message : 'Failed to save cell.');
        return false;
      } finally {
        setSavingCells((prev) => setInRecord(prev, id, false));
      }
    },
    [clearConflictLater, host, lookups, queryClient, queryKey, toast],
  );

  const columns = useMemo(
    () =>
      RUNNING_JOBS_COLUMNS.map((column) => ({
        key: column.key,
        letter: column.letter,
        label: column.label,
        widthPx: column.widthPx,
        editable: column.editable,
        frozen: column.frozen,
        sourceLabel: column.sourceLabel ?? null,
      })),
    [],
  );

  const toolbar = (
    <Toolbar
      filters={filters}
      onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      years={years}
      crews={lookups.crews}
      stages={stages}
      totalRows={allRows.length}
      visibleRows={visibleRows.length}
      generatedAt={query.data?.generatedAt ?? null}
    />
  );

  return {
    title: 'Running Jobs',
    toolbar,
    columns,
    allRows,
    rowNumberRows,
    groups: filteredGroups.map((group) => ({ key: `year_${group.year}`, label: String(group.year), rows: group.rows })),
    zoomStorageKey: 'sp_running_jobs_sheet_zoom_v1',
    defaultActiveKey: 'client_name',
    loading: query.isLoading,
    hasError: Boolean(query.error),
    loadingMessage: 'Loading running jobs...',
    errorMessage: 'Could not load running jobs.',
    emptyMessage: 'No matching jobs.',
    savingCells,
    conflictCells,
    getRowId: (row) => row.projectId,
    isRowSelectable: (row) => !isLegacySheetRow(row),
    isEditableKey: (key): key is RunningJobEditableCellKey => RUNNING_JOBS_COLUMNS.some((column) => column.key === key && column.editable),
    getRowClassName: (row) => {
      const classNames = [styles.row];
      if (isLegacySheetRow(row)) classNames.push(styles.rowLegacy);
      if (row.stage === 'DEPOSIT' && !row.state.hasCrewAssigned && !row.state.hasEstimatedStartDate) classNames.push(styles.rowDeposit);
      if (isInProgress(row)) classNames.push(styles.rowInProgress);
      if (row.stage === 'COMPLETED') classNames.push(styles.rowCompleted);
      if (row.stage === 'PAID') classNames.push(styles.rowPaid);
      return classNames.join(' ');
    },
    getCellClassName: ({ row, column, active, editing, saving, conflict }) => {
      const classNames = [styles.bodyCell];
      if (isLegacySheetRow(row)) classNames.push(styles.legacyCell);
      if (column.frozen) classNames.push(styles.frozenCell);
      if (column.key === 'running_notes') classNames.push(styles.notesCell);
      if (column.editable) classNames.push(styles.editableCell);
      if (column.sourceLabel === 'Schedule') classNames.push(styles.scheduleCell);
      if (column.sourceLabel === 'Estimate') classNames.push(styles.estimateCell);
      if (active) classNames.push(styles.activeCell);
      if (editing) classNames.push(styles.editingCell);
      if (saving) classNames.push(styles.savingCell);
      if (conflict) classNames.push(styles.conflictCell);
      if (column.key === 'estimated_start_date' && isOverdue(row)) classNames.push(styles.overdueCell);
      if (
        (column.key === 'materials_ordered' && row.cells.materials_ordered) ||
        (column.key === 'roofing_ordered' && row.cells.roofing_ordered) ||
        (column.key === 'job_completed' && row.cells.job_completed)
      ) {
        classNames.push(styles.completeCell);
      }
      if (
        (column.key === 'lights_status' && row.cells.lights_status === 'TBC') ||
        (column.key === 'blinds_status' && row.cells.blinds_status === 'TBC')
      ) {
        classNames.push(styles.pendingCell);
      }
      return classNames.join(' ');
    },
    formatCellValue,
    renderCellContent: ({ row, column, text }) => {
      if (column.key === 'client_name') {
        return (
          <div className={styles.clientCell}>
            <span>{text || 'Untitled'}</span>
            {isLegacySheetRow(row) ? <span className={styles.projectLinkMuted}>Legacy</span> : null}
            {!isLegacySheetRow(row) ? (
              <Link
                className={styles.projectLink}
                href={`/staff/projects/${encodeURIComponent(row.projectId)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                Open
              </Link>
            ) : null}
          </div>
        );
      }

      if (column.key === 'running_notes') {
        return <span className={styles.notesPreview}>{text || '—'}</span>;
      }

      return text || <span className={styles.muted}>-</span>;
    },
    getEditorValue: (row, key) => getRunningJobEditorValue(row, key),
    renderEditor: ({ row, key, value, setValue, commit, cancel, commitToNeighbor, editorRef, onBlur }) => {
      const onTextKeyDown = async (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === 'Escape') {
          cancel();
          return;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          await commitToNeighbor(event.shiftKey ? -1 : 1);
          return;
        }
        if (event.key === 'Enter' && key !== 'running_notes') {
          event.preventDefault();
          await commit();
          return;
        }
        if (event.key === 'Enter' && key === 'running_notes' && !event.shiftKey) {
          event.preventDefault();
          await commit();
        }
      };

      if (key === 'site_visit_rep') {
        return (
          <select
            ref={editorRef}
            onBlur={onBlur}
            className={styles.cellSelect}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => setValue(event.target.value || null)}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                cancel();
              }
              if (event.key === 'Tab') {
                event.preventDefault();
                await commitToNeighbor(event.shiftKey ? -1 : 1);
              }
            }}
          >
            <option value="">Unassigned</option>
            {lookups.salesPeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.shortLabel}
              </option>
            ))}
          </select>
        );
      }

      if (key === 'job_assigned_to') {
        return (
          <select
            ref={editorRef}
            onBlur={onBlur}
            className={styles.cellSelect}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                cancel();
              }
              if (event.key === 'Tab') {
                event.preventDefault();
                await commitToNeighbor(event.shiftKey ? -1 : 1);
              }
            }}
          >
            <option value="" disabled>
              Select crew
            </option>
            {lookups.crews
              .filter((crew) => crew.active)
              .map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.shortCode ?? crew.name}
                </option>
              ))}
          </select>
        );
      }

      if (key === 'lights_status') {
        return (
          <select
            ref={editorRef}
            onBlur={onBlur}
            className={styles.cellSelect}
            value={String(value ?? 'TBC')}
            onChange={(event) => setValue(event.target.value as RunningJobStatusValue)}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                cancel();
              }
              if (event.key === 'Tab') {
                event.preventDefault();
                await commitToNeighbor(event.shiftKey ? -1 : 1);
              }
            }}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
            <option value="TBC">TBC</option>
          </select>
        );
      }

      if (key === 'running_notes') {
        return (
          <textarea
            ref={editorRef}
            onBlur={onBlur}
            className={styles.notesEditor}
            rows={4}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onTextKeyDown}
          />
        );
      }

      const inputType = key === 'deposit_paid_date' || key === 'estimated_start_date' || key === 'final_payment_date' ? 'date' : key === 'install_days' ? 'number' : 'text';

      return (
        <input
          ref={editorRef}
          onBlur={onBlur}
          className={styles.cellInput}
          type={inputType}
          min={key === 'install_days' ? 1 : undefined}
          value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onTextKeyDown}
        />
      );
    },
    commitEdit: persistCell,
    onCellActivated: async ({ trigger, row, key, seed, beginEdit }) => {
      if (!RUNNING_JOBS_COLUMNS.some((column) => column.key === key && column.editable)) {
        return 'noop';
      }

      if (key === 'materials_ordered' || key === 'roofing_ordered' || key === 'job_completed') {
        if (trigger === 'enter' || trigger === 'space' || trigger === 'double_click') {
          const current = Boolean(getRunningJobEditorValue(row, key));
          await persistCell(row, key, !current);
          return 'handled';
        }
        return 'noop';
      }

      if (trigger === 'click' || trigger === 'enter' || trigger === 'double_click') {
        beginEdit();
        return 'handled';
      }

      if (trigger === 'printable' && seed) {
        beginEdit(seed);
        return 'handled';
      }

      return 'noop';
    },
  };
}
