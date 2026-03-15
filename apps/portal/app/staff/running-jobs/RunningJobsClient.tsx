'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { ApiError } from '@/lib/repo/apiClient';
import { mutateRunningJobCell } from '@/lib/repo/runningJobsRepo';
import { qk } from '@/lib/queries/keys';
import { runningJobsQueryOptions } from '@/lib/queries/runningJobs';
import { RUNNING_JOBS_COLUMNS, type RunningJobsColumnConfig } from '@/lib/runningJobs/columns';
import {
  applyOptimisticRunningJobCellValue,
  getRunningJobCellEditability,
  getRunningJobEditorValue,
  normalizeRunningJobCellInput,
  type NormalizedRunningJobCellValue,
} from '@/lib/runningJobs/editing';
import { flattenRunningJobGroups, groupRunningJobRows, updateRunningJobRowInGroups } from '@/lib/runningJobs/group';
import type {
  RunningJobCellKey,
  RunningJobEditableCellKey,
  RunningJobRow,
  RunningJobsResponse,
  RunningJobStatusValue,
} from '@/lib/runningJobs/types';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import styles from './running-jobs.module.css';

type ActiveCell = {
  projectId: string;
  key: RunningJobCellKey;
};

type EditingCell = {
  projectId: string;
  key: RunningJobEditableCellKey;
  value: NormalizedRunningJobCellValue;
};

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

const ALL_CELLS = RUNNING_JOBS_COLUMNS.map((column) => column.key);
const TODAY_YMD = new Date().toISOString().slice(0, 10);

function cellId(projectId: string, key: RunningJobCellKey): string {
  return `${projectId}:${key}`;
}

function isEditableKey(key: RunningJobCellKey): key is RunningJobEditableCellKey {
  return RUNNING_JOBS_COLUMNS.some((column) => column.key === key && column.editable);
}

function countRows(groups: RunningJobsResponse['groups']): number {
  return groups.reduce((sum, group) => sum + group.rows.length, 0);
}

function stickyLeftFor(columnIndex: number): number {
  let left = 0;
  for (let index = 0; index < columnIndex; index += 1) {
    const column = RUNNING_JOBS_COLUMNS[index];
    if (column?.frozen) left += column.widthPx;
  }
  return left;
}

function formatCellValue(row: RunningJobRow, key: RunningJobCellKey): string {
  const value = row.cells[key];
  if (typeof value === 'boolean') return value ? 'Y' : '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value;
  return value ?? '';
}

function isOverdue(row: RunningJobRow): boolean {
  return Boolean(row.cells.estimated_start_date && row.cells.estimated_start_date < TODAY_YMD && !row.cells.job_completed);
}

function isInProgress(row: RunningJobRow): boolean {
  return row.state.schedule.status === 'in_progress';
}

function isDerivedEstimateColumn(column: RunningJobsColumnConfig): boolean {
  return column.source === 'estimate';
}

function isScheduleColumn(column: RunningJobsColumnConfig): boolean {
  return column.source === 'schedule';
}

function isPrintableKey(event: ReactKeyboardEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
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

function getCellClasses(input: {
  row: RunningJobRow;
  column: RunningJobsColumnConfig;
  active: boolean;
  editing: boolean;
  saving: boolean;
  conflict: boolean;
}): string {
  const classNames = [styles.bodyCell];
  if (input.column.frozen) classNames.push(styles.frozenCell);
  if (input.column.kind === 'notes') classNames.push(styles.notesCell);
  if (input.column.editable) classNames.push(styles.editableCell);
  if (isScheduleColumn(input.column)) classNames.push(styles.scheduleCell);
  if (isDerivedEstimateColumn(input.column)) classNames.push(styles.estimateCell);
  if (input.active) classNames.push(styles.activeCell);
  if (input.editing) classNames.push(styles.editingCell);
  if (input.saving) classNames.push(styles.savingCell);
  if (input.conflict) classNames.push(styles.conflictCell);
  if (input.column.key === 'estimated_start_date' && isOverdue(input.row)) classNames.push(styles.overdueCell);
  if (
    (input.column.key === 'materials_ordered' && input.row.cells.materials_ordered) ||
    (input.column.key === 'roofing_ordered' && input.row.cells.roofing_ordered) ||
    (input.column.key === 'job_completed' && input.row.cells.job_completed)
  ) {
    classNames.push(styles.completeCell);
  }
  if (
    (input.column.key === 'lights_status' && input.row.cells.lights_status === 'TBC') ||
    (input.column.key === 'blinds_status' && input.row.cells.blinds_status === 'TBC')
  ) {
    classNames.push(styles.pendingCell);
  }
  return classNames.join(' ');
}

function getRowClasses(row: RunningJobRow): string {
  const classNames = [styles.row];
  if (row.stage === 'DEPOSIT' && !row.state.hasCrewAssigned && !row.state.hasEstimatedStartDate) classNames.push(styles.rowDeposit);
  if (isInProgress(row)) classNames.push(styles.rowInProgress);
  if (row.stage === 'COMPLETED') classNames.push(styles.rowCompleted);
  if (row.stage === 'PAID') classNames.push(styles.rowPaid);
  return classNames.join(' ');
}

function groupRowsByFilters(groups: RunningJobsResponse['groups'], filters: Filters): RunningJobsResponse['groups'] {
  const query = filters.search.trim().toLowerCase();
  const rows = flattenRunningJobGroups(groups).filter((row) => {
    if (filters.year !== 'all' && String(row.cells.estimated_start_date?.slice(0, 4) ?? row.state.projectCreatedAt?.slice(0, 4) ?? '') !== filters.year) {
      return false;
    }
    if (filters.crewId !== 'all' && row.state.schedule.crewId !== filters.crewId) return false;
    if (filters.stage !== 'all' && row.stage !== filters.stage) return false;
    if (filters.overdueOnly && !isOverdue(row)) return false;
    if (!filters.showCompleted && isCompletedRow(row)) return false;
    if (!query) return true;

    return [
      row.cells.client_name,
      row.cells.phone_number,
      row.cells.site_address,
      row.cells.pergola_type,
      row.cells.running_notes,
      row.cells.job_assigned_to ?? '',
      row.cells.site_visit_rep ?? '',
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

function cellStyle(column: RunningJobsColumnConfig, index: number): React.CSSProperties | undefined {
  return column.frozen ? { left: stickyLeftFor(index) } : undefined;
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

export default function RunningJobsClient() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const host = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const queryKey = qk.runningJobs.list(host);
  const query = useQuery(runningJobsQueryOptions(host));

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [conflictCells, setConflictCells] = useState<Record<string, boolean>>({});

  const gridRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const skipBlurCommitRef = useRef(false);

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
  const rowsByProjectId = useMemo(() => new Map(allRows.map((row) => [row.projectId, row])), [allRows]);
  const visibleProjectIds = useMemo(() => new Set(visibleRows.map((row) => row.projectId)), [visibleRows]);

  const years = useMemo(() => Array.from(new Set(allRows.map((row) => String(row.cells.estimated_start_date?.slice(0, 4) ?? row.state.projectCreatedAt?.slice(0, 4) ?? '')))).filter(Boolean).sort().reverse(), [allRows]);
  const stages = useMemo(() => Array.from(new Set(allRows.map((row) => row.stage))).sort(), [allRows]);

  useEffect(() => {
    if (!visibleRows.length) {
      setActiveCell(null);
      setEditing(null);
      return;
    }
    if (activeCell && visibleProjectIds.has(activeCell.projectId)) return;
    setActiveCell({ projectId: visibleRows[0].projectId, key: 'client_name' });
  }, [activeCell, visibleProjectIds, visibleRows]);

  useEffect(() => {
    if (!editing) return;
    const node = editorRef.current;
    if (!node) return;
    node.focus();
    if ('select' in node) node.select?.();
  }, [editing]);

  useEffect(() => {
    if (!activeCell) return;
    const node = cellRefs.current.get(cellId(activeCell.projectId, activeCell.key));
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeCell]);

  const setCellRef = useCallback((id: string, node: HTMLTableCellElement | null) => {
    if (!node) {
      cellRefs.current.delete(id);
      return;
    }
    cellRefs.current.set(id, node);
  }, []);

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

      const id = cellId(row.projectId, key);
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

  const moveActiveCell = useCallback(
    (rowDelta: number, columnDelta: number) => {
      if (!activeCell || !visibleRows.length) return;
      const rowIndex = visibleRows.findIndex((row) => row.projectId === activeCell.projectId);
      const columnIndex = ALL_CELLS.indexOf(activeCell.key);
      const nextRow = visibleRows[Math.max(0, Math.min(visibleRows.length - 1, rowIndex + rowDelta))];
      const nextColumn = ALL_CELLS[Math.max(0, Math.min(ALL_CELLS.length - 1, columnIndex + columnDelta))] ?? activeCell.key;
      setActiveCell({ projectId: nextRow.projectId, key: nextColumn });
    },
    [activeCell, visibleRows],
  );

  const beginEdit = useCallback(
    (row: RunningJobRow, key: RunningJobCellKey, seeded?: string) => {
      if (!isEditableKey(key)) return;
      const editability = getRunningJobCellEditability(row, key);
      if (!editability.editable) {
        toast.error(editability.reason ?? 'This cell cannot be edited yet.');
        return;
      }

      const initialValue = seeded !== undefined ? seeded : getRunningJobEditorValue(row, key);
      setEditing({
        projectId: row.projectId,
        key,
        value: seeded !== undefined ? seeded : initialValue,
      });
    },
    [toast],
  );

  const toggleBooleanCell = useCallback(
    async (row: RunningJobRow, key: RunningJobEditableCellKey) => {
      if (key !== 'materials_ordered' && key !== 'roofing_ordered' && key !== 'job_completed') return;
      const current = Boolean(getRunningJobEditorValue(row, key));
      await persistCell(row, key, !current);
    },
    [persistCell],
  );

  const commitEditing = useCallback(
    async (nextSelection?: ActiveCell | null): Promise<boolean> => {
      if (!editing) return true;
      const row = rowsByProjectId.get(editing.projectId);
      if (!row) {
        setEditing(null);
        return false;
      }

      const ok = await persistCell(row, editing.key, editing.value);
      if (ok) {
        setEditing(null);
        if (nextSelection) setActiveCell(nextSelection);
      }
      return ok;
    },
    [editing, persistCell, rowsByProjectId],
  );

  const handleGridKeyDown = useCallback(
    async (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!activeCell) return;
      if (editing) return;

      const row = rowsByProjectId.get(activeCell.projectId);
      if (!row) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveActiveCell(0, 1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveActiveCell(0, -1);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveActiveCell(1, 0);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveActiveCell(-1, 0);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        moveActiveCell(0, event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (isEditableKey(activeCell.key)) {
          if (activeCell.key === 'materials_ordered' || activeCell.key === 'roofing_ordered' || activeCell.key === 'job_completed') {
            await toggleBooleanCell(row, activeCell.key);
            return;
          }
          beginEdit(row, activeCell.key);
        }
        return;
      }
      if (event.key === ' ') {
        if (isEditableKey(activeCell.key) && (activeCell.key === 'materials_ordered' || activeCell.key === 'roofing_ordered' || activeCell.key === 'job_completed')) {
          event.preventDefault();
          await toggleBooleanCell(row, activeCell.key);
        }
        return;
      }
      if (isPrintableKey(event) && isEditableKey(activeCell.key)) {
        event.preventDefault();
        beginEdit(row, activeCell.key, event.key);
      }
    },
    [activeCell, beginEdit, editing, moveActiveCell, rowsByProjectId, toggleBooleanCell],
  );

  const renderEditor = useCallback(
    (row: RunningJobRow, key: RunningJobEditableCellKey) => {
      if (!editing || editing.projectId !== row.projectId || editing.key !== key) return null;

      const commitToNeighbor = async (columnDelta: number) => {
        const rowIndex = visibleRows.findIndex((item) => item.projectId === row.projectId);
        const columnIndex = ALL_CELLS.indexOf(key);
        const nextRow = visibleRows[Math.max(0, rowIndex)];
        const nextColumn = ALL_CELLS[Math.max(0, Math.min(ALL_CELLS.length - 1, columnIndex + columnDelta))] ?? key;
        await commitEditing({ projectId: nextRow.projectId, key: nextColumn });
      };

      const onTextKeyDown = async (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === 'Escape') {
          skipBlurCommitRef.current = true;
          setEditing(null);
          return;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          await commitToNeighbor(event.shiftKey ? -1 : 1);
          return;
        }
        if (event.key === 'Enter' && key !== 'running_notes') {
          event.preventDefault();
          await commitEditing();
          return;
        }
        if (event.key === 'Enter' && key === 'running_notes' && !event.shiftKey) {
          event.preventDefault();
          await commitEditing();
        }
      };

      const commonProps = {
        ref: (node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
          editorRef.current = node;
        },
        onBlur: async () => {
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          await commitEditing();
        },
      };

      if (key === 'site_visit_rep') {
        return (
          <select
            {...commonProps}
            className={styles.cellSelect}
            value={typeof editing.value === 'string' ? editing.value : ''}
            onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: event.target.value || null } : prev))}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                skipBlurCommitRef.current = true;
                setEditing(null);
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
            {...commonProps}
            className={styles.cellSelect}
            value={typeof editing.value === 'string' ? editing.value : ''}
            onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                skipBlurCommitRef.current = true;
                setEditing(null);
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
            {...commonProps}
            className={styles.cellSelect}
            value={String(editing.value ?? 'TBC')}
            onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: event.target.value as RunningJobStatusValue } : prev))}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                skipBlurCommitRef.current = true;
                setEditing(null);
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
            {...commonProps}
            className={styles.notesEditor}
            rows={4}
            value={typeof editing.value === 'string' ? editing.value : ''}
            onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
            onKeyDown={onTextKeyDown}
          />
        );
      }

      const inputType = key === 'deposit_paid_date' || key === 'estimated_start_date' || key === 'final_payment_date' ? 'date' : key === 'install_days' ? 'number' : 'text';

      return (
        <input
          {...commonProps}
          className={styles.cellInput}
          type={inputType}
          min={key === 'install_days' ? 1 : undefined}
          value={typeof editing.value === 'string' || typeof editing.value === 'number' ? String(editing.value) : ''}
          onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: inputType === 'number' ? event.target.value : event.target.value } : prev))}
          onKeyDown={onTextKeyDown}
        />
      );
    },
    [commitEditing, editing, lookups.crews, lookups.salesPeople, visibleRows],
  );

  return (
    <main className={styles.page}>
      <PageHeader title="Running Jobs" />

      <div className={styles.stack}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Live Sheet</h2>
              <p className={styles.sectionCopy}>Shared operations grid for live install jobs. Schedule remains authoritative for crew, dates, completion, and install days.</p>
            </div>
          </div>

          <Toolbar
            filters={filters}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            years={years}
            crews={lookups.crews}
            stages={stages}
            totalRows={allRows.length}
            visibleRows={countRows(filteredGroups)}
            generatedAt={query.data?.generatedAt ?? null}
          />

          {query.isLoading && !query.data ? (
            <div className={styles.emptyState}>Loading running jobs...</div>
          ) : query.error && !query.data ? (
            <div className={styles.emptyState}>Could not load running jobs.</div>
          ) : !visibleRows.length ? (
            <div className={styles.emptyTable}>No matching jobs.</div>
          ) : (
            <div ref={gridRef} className={styles.tableScroller} tabIndex={0} onKeyDown={handleGridKeyDown}>
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
                        style={cellStyle(column, index)}
                        scope="col"
                      >
                        <span className={styles.headerLetter}>{column.letter}</span>
                        <span className={styles.headerLabel}>{column.label}</span>
                        {column.source === 'estimate' ? <span className={styles.headerSource}>Estimate</span> : null}
                        {column.source === 'schedule' ? <span className={styles.headerSource}>Schedule</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                {filteredGroups.map((group) => (
                  <tbody key={group.year}>
                    <tr>
                      <th className={styles.yearRow} colSpan={RUNNING_JOBS_COLUMNS.length} scope="rowgroup">
                        {group.year}
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.projectId} className={getRowClasses(row)}>
                        {RUNNING_JOBS_COLUMNS.map((column, index) => {
                          const id = cellId(row.projectId, column.key);
                          const isActive = activeCell?.projectId === row.projectId && activeCell?.key === column.key;
                          const isEditing = editing?.projectId === row.projectId && editing?.key === column.key;
                          const text = formatCellValue(row, column.key);

                          const content =
                            column.key === 'client_name' ? (
                              <div className={styles.clientCell}>
                                <span>{text || 'Untitled'}</span>
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
                              </div>
                            ) : column.key === 'running_notes' ? (
                              <span className={styles.notesPreview}>{text || '—'}</span>
                            ) : text || <span className={styles.muted}>-</span>;

                          return (
                            <td
                              key={column.key}
                              ref={(node) => setCellRef(id, node)}
                              data-cell-id={id}
                              className={getCellClasses({
                                row,
                                column,
                                active: Boolean(isActive),
                                editing: Boolean(isEditing),
                                saving: Boolean(savingCells[id]),
                                conflict: Boolean(conflictCells[id]),
                              })}
                              style={cellStyle(column, index)}
                              onClick={() => {
                                setActiveCell({ projectId: row.projectId, key: column.key });
                                gridRef.current?.focus();
                              }}
                              onDoubleClick={() => {
                                if (column.key === 'materials_ordered' || column.key === 'roofing_ordered' || column.key === 'job_completed') {
                                  if (isEditableKey(column.key)) void toggleBooleanCell(row, column.key);
                                  return;
                                }
                                if (isEditableKey(column.key)) beginEdit(row, column.key);
                              }}
                            >
                              {isEditing && isEditableKey(column.key) ? renderEditor(row, column.key) : content}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
