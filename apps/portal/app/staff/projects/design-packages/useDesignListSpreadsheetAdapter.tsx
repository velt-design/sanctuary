'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import type { SpreadsheetAdapter } from '@/components/spreadsheet/types';
import styles from '@/components/spreadsheet/spreadsheet.module.css';
import { DESIGN_LIST_COLUMNS } from '@/lib/designPackages/columns';
import { DESIGN_PACKAGE_DESIGNERS, getDesignPackageDesignerLabel, isKnownDesignPackageDesignerId } from '@/lib/designPackages/designers';
import {
  applyOptimisticDesignListCellValue,
  getDesignListCellEditability,
  getDesignListEditorValue,
  normalizeDesignListCellInput,
  type NormalizedDesignListCellValue,
} from '@/lib/designPackages/editing';
import { compareDesignListRows, groupDesignListRows, updateDesignListRow, yearForDesignListRow } from '@/lib/designPackages/group';
import type {
  DesignListCellKey,
  DesignListEditableCellKey,
  DesignListRow,
  DesignPackagesResponse,
  DesignRequestPriorityTier,
  DesignRequestStatus,
} from '@/lib/designPackages/types';
import { qk } from '@/lib/queries/keys';
import { designPackagesQueryOptions } from '@/lib/queries/designPackages';
import { ApiError } from '@/lib/repo/apiClient';
import { mutateDesignListCell } from '@/lib/repo/designPackagesRepo';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

type Filters = {
  search: string;
  year: string;
  designerId: string;
  status: string;
  overdueOnly: boolean;
  showCompleted: boolean;
};

const DEFAULT_FILTERS: Filters = {
  search: '',
  year: 'all',
  designerId: 'all',
  status: 'all',
  overdueOnly: false,
  showCompleted: false,
};

const DESIGN_LIST_STATUSES: readonly DesignRequestStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const DESIGN_LIST_PRIORITY_TIERS: readonly DesignRequestPriorityTier[] = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'UNPRICED'];
const TODAY_YMD = new Date().toISOString().slice(0, 10);

function toYmd(value: string | null): string {
  if (!value) return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
}

function formatStatusLabel(value: DesignRequestStatus): string {
  return value.replace(/_/g, ' ');
}

function formatTierLabel(value: DesignRequestPriorityTier): string {
  if (value === 'UNPRICED') return 'Unpriced';
  const suffix = value.split('_').at(-1) ?? '';
  return `Tier ${suffix}`;
}

function formatVisitedValue(row: DesignListRow): string {
  if (!row.visitStatus) return '';
  if (row.visitStatus === 'COMPLETED') return 'Visited';
  if (row.visitStatus === 'CONFIRMED' || row.visitStatus === 'TENTATIVE') return 'Booked';
  if (row.visitStatus === 'CANCELLED') return 'Cancelled';
  return row.visitStatus;
}

function formatCellValue(row: DesignListRow, key: DesignListCellKey): string {
  switch (key) {
    case 'date':
      return toYmd(row.requestedAt);
    case 'quote_name':
      return row.quoteName;
    case 'site_visit_rep':
      return row.siteVisitRep ?? '';
    case 'designer':
      return getDesignPackageDesignerLabel(row.assignedDesignerId);
    case 'design_ready':
      return formatStatusLabel(row.status);
    case 'priority':
      return formatTierLabel(row.priorityTier);
    case 'sent':
      return toYmd(row.sentAt);
    case 'visited':
      return formatVisitedValue(row);
    case 'notes':
      return row.notes;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function searchTextForRow(row: DesignListRow): string {
  return [
    row.quoteName,
    row.projectName,
    row.clientName,
    row.siteAddress,
    row.notes,
    row.requestNote,
    row.designerNote,
    getDesignPackageDesignerLabel(row.assignedDesignerId),
    row.siteVisitRep,
    row.sentQuoteRef,
    row.estimateVersionLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isOverdue(row: DesignListRow): boolean {
  return Boolean(row.dueAt && toYmd(row.dueAt) < TODAY_YMD && row.status !== 'DONE' && row.status !== 'CANCELLED');
}

function isCompletedRow(row: DesignListRow): boolean {
  return row.status === 'DONE' || row.status === 'CANCELLED';
}

function setInRecord(record: Record<string, boolean>, key: string, value: boolean): Record<string, boolean> {
  if (value) return { ...record, [key]: true };
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function groupRowsByFilters(rows: DesignListRow[], filters: Filters): Array<{ year: number; rows: DesignListRow[] }> {
  const query = filters.search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (filters.year !== 'all' && String(yearForDesignListRow(row)) !== filters.year) return false;
    if (filters.designerId === 'unassigned' && row.assignedDesignerId) return false;
    if (filters.designerId !== 'all' && filters.designerId !== 'unassigned' && row.assignedDesignerId !== filters.designerId) return false;
    if (filters.status !== 'all' && row.status !== filters.status) return false;
    if (filters.overdueOnly && !isOverdue(row)) return false;
    if (!filters.showCompleted && isCompletedRow(row)) return false;
    if (!query) return true;
    return searchTextForRow(row).includes(query);
  });

  return groupDesignListRows(filteredRows);
}

function patchResponse(prev: DesignPackagesResponse, requestId: string, updater: (row: DesignListRow) => DesignListRow): DesignPackagesResponse {
  return {
    ...prev,
    generatedAt: new Date().toISOString(),
    rows: updateDesignListRow(prev.rows, requestId, updater),
  };
}

function replaceResponseRow(prev: DesignPackagesResponse, updatedRow: DesignListRow): DesignPackagesResponse {
  return {
    ...prev,
    generatedAt: new Date().toISOString(),
    rows: updateDesignListRow(prev.rows, updatedRow.requestId, () => updatedRow),
  };
}

function Toolbar({
  filters,
  onChange,
  years,
  designers,
  totalRows,
  visibleRows,
  generatedAt,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  years: string[];
  designers: DesignPackagesResponse['lookups']['designers'];
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
          {visibleRows} of {totalRows} requests
        </span>
        <span>{generatedAt ? `Generated ${generatedAt.replace('T', ' ').slice(0, 16)}` : 'Loading...'}</span>
      </div>
    </div>
  );
}

export function useDesignListSpreadsheetAdapter(): SpreadsheetAdapter<
  DesignListRow,
  DesignListCellKey,
  DesignListEditableCellKey,
  NormalizedDesignListCellValue
> {
  const toast = useToast();
  const queryClient = useQueryClient();
  const host = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const queryKey = qk.designPackages.list(host);
  const query = useQuery(designPackagesQueryOptions(host));

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [conflictCells, setConflictCells] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!query.error) return;
    const message = query.error instanceof Error ? query.error.message : 'Failed to load design list.';
    toast.error(message);
  }, [query.error, toast]);

  const allRows = query.data?.rows ?? [];
  const lookups = query.data?.lookups ?? { designers: [] };
  const filteredGroups = useMemo(() => groupRowsByFilters(allRows, filters), [allRows, filters]);
  const visibleRows = useMemo(() => filteredGroups.flatMap((group) => group.rows), [filteredGroups]);
  const rowNumberRows = useMemo(() => allRows.slice().sort(compareDesignListRows), [allRows]);

  const years = useMemo(() => Array.from(new Set(allRows.map((row) => String(yearForDesignListRow(row))))).sort(), [allRows]);

  const persistCell = useCallback(
    async (row: DesignListRow, key: DesignListEditableCellKey, value: NormalizedDesignListCellValue): Promise<boolean> => {
      const normalized = normalizeDesignListCellInput(key, value);
      if (!normalized.ok) {
        toast.error(normalized.error);
        return false;
      }

      const editability = getDesignListCellEditability(row, key);
      if (!editability.editable) {
        toast.error(editability.reason ?? 'This cell cannot be edited right now.');
        return false;
      }

      const id = `${row.requestId}:${key}`;
      const previous = queryClient.getQueryData<DesignPackagesResponse>(queryKey);
      setSavingCells((prev) => setInRecord(prev, id, true));
      setConflictCells((prev) => setInRecord(prev, id, false));

      if (previous) {
        queryClient.setQueryData<DesignPackagesResponse>(
          queryKey,
          patchResponse(previous, row.requestId, (current) => applyOptimisticDesignListCellValue(current, key, normalized.value, lookups)),
        );
      }

      try {
        const saveCell = async (targetRowVersion: string) =>
          mutateDesignListCell({
            requestId: row.requestId,
            rowVersion: targetRowVersion,
            key,
            value: normalized.value,
          });

        let response;

        try {
          response = await saveCell(row.rowVersion);
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) {
            throw error;
          }

          const currentRow = (error.body as any)?.currentRow as DesignListRow | undefined;
          if (!currentRow) throw error;

          queryClient.setQueryData<DesignPackagesResponse>(queryKey, (current) =>
            current
              ? patchResponse(current, currentRow.requestId, () =>
                  applyOptimisticDesignListCellValue(currentRow, key, normalized.value, lookups),
                )
              : current,
          );

          response = await saveCell(currentRow.rowVersion);
        }

        queryClient.setQueryData<DesignPackagesResponse>(queryKey, (current) =>
          current ? replaceResponseRow(current, response.updatedRow) : current,
        );

        void queryClient.invalidateQueries({ queryKey: qk.projects.detail(host, row.projectId) });
        void queryClient.invalidateQueries({ queryKey: qk.projects.snapshot(host, row.projectId) });
        void queryClient.invalidateQueries({ queryKey: qk.automation.designTicket(host, row.projectId) });
        void queryClient.invalidateQueries({ queryKey: qk.automation.tasks(host, row.projectId) });
        return true;
      } catch (error) {
        if (previous) queryClient.setQueryData(queryKey, previous);
        toast.error(error instanceof Error ? error.message : 'Failed to save cell.');
        return false;
      } finally {
        setSavingCells((prev) => setInRecord(prev, id, false));
      }
    },
    [host, lookups, queryClient, queryKey, toast],
  );

  const columns = useMemo(
    () =>
      DESIGN_LIST_COLUMNS.map((column) => ({
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
      designers={lookups.designers}
      totalRows={allRows.length}
      visibleRows={visibleRows.length}
      generatedAt={query.data?.generatedAt ?? null}
    />
  );

  return {
    title: 'Design List',
    toolbar,
    columns,
    allRows,
    rowNumberRows,
    groups: filteredGroups.map((group) => ({ key: `year_${group.year}`, label: String(group.year), rows: group.rows })),
    zoomStorageKey: 'sp_design_list_sheet_zoom_v1',
    defaultActiveKey: 'quote_name',
    loading: query.isLoading,
    hasError: Boolean(query.error),
    loadingMessage: 'Loading design list...',
    errorMessage: 'Could not load design list.',
    emptyMessage: 'No matching requests.',
    savingCells,
    conflictCells,
    getRowId: (row) => row.requestId,
    isEditableKey: (key): key is DesignListEditableCellKey => key === 'designer' || key === 'design_ready' || key === 'priority' || key === 'notes',
    getRowClassName: (row) => {
      const classNames = [styles.row];
      if (row.status === 'IN_PROGRESS') classNames.push(styles.rowInProgress);
      if (row.status === 'DONE') classNames.push(styles.rowCompleted);
      if (row.status === 'CANCELLED') classNames.push(styles.rowLegacy);
      if (row.status === 'BLOCKED') classNames.push(styles.rowDeposit);
      return classNames.join(' ');
    },
    getCellClassName: ({ row, column, active, editing, saving, conflict }) => {
      const classNames = [styles.bodyCell];
      if (column.frozen) classNames.push(styles.frozenCell);
      if (column.key === 'notes') classNames.push(styles.notesCell);
      if (column.editable) classNames.push(styles.editableCell);
      if (column.sourceLabel === 'Quote' || column.sourceLabel === 'Derived') classNames.push(styles.estimateCell);
      if (column.sourceLabel === 'Visit') classNames.push(styles.scheduleCell);
      if (active) classNames.push(styles.activeCell);
      if (editing) classNames.push(styles.editingCell);
      if (saving) classNames.push(styles.savingCell);
      if (conflict) classNames.push(styles.conflictCell);
      if (column.key === 'design_ready' && isOverdue(row)) classNames.push(styles.overdueCell);
      if ((column.key === 'design_ready' && row.status === 'DONE') || (column.key === 'sent' && row.sentAt)) {
        classNames.push(styles.completeCell);
      }
      if ((column.key === 'design_ready' && row.status === 'BLOCKED') || (column.key === 'priority' && row.priorityTier === 'UNPRICED')) {
        classNames.push(styles.pendingCell);
      }
      return classNames.join(' ');
    },
    formatCellValue,
    renderCellContent: ({ row, column, text }) => {
      if (column.key === 'quote_name') {
        return (
          <div className={styles.clientCell}>
            <span>{text || 'Untitled'}</span>
            <Link
              className={styles.projectLink}
              href={`/staff/projects/${encodeURIComponent(row.projectId)}?tab=estimates`}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              Open
            </Link>
          </div>
        );
      }

      if (column.key === 'notes') {
        return <span className={styles.notesPreview}>{text || '—'}</span>;
      }

      return text || <span className={styles.muted}>-</span>;
    },
    getEditorValue: (row, key) => getDesignListEditorValue(row, key),
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
        if (event.key === 'Enter' && key !== 'notes') {
          event.preventDefault();
          await commit();
          return;
        }
        if (event.key === 'Enter' && key === 'notes' && !event.shiftKey) {
          event.preventDefault();
          await commit();
        }
      };

      if (key === 'designer') {
        const currentDesignerId = typeof value === 'string' ? value : row.assignedDesignerId;
        const hasLegacyDesignerOption = Boolean(currentDesignerId && !isKnownDesignPackageDesignerId(currentDesignerId));

        return (
          <select
            ref={editorRef}
            onBlur={onBlur}
            className={styles.cellSelect}
            value={currentDesignerId ?? ''}
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
            {hasLegacyDesignerOption && currentDesignerId ? (
              <option value={currentDesignerId}>{getDesignPackageDesignerLabel(currentDesignerId)}</option>
            ) : null}
            {DESIGN_PACKAGE_DESIGNERS.map((designer) => (
              <option key={designer.id} value={designer.id}>
                {designer.code}
              </option>
            ))}
          </select>
        );
      }

      if (key === 'design_ready') {
        return (
          <select
            ref={editorRef}
            onBlur={onBlur}
            className={styles.cellSelect}
            value={typeof value === 'string' ? value : row.status}
            onChange={(event) => setValue(event.target.value as DesignRequestStatus)}
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
            {DESIGN_LIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
        );
      }

      if (key === 'priority') {
        return (
          <select
            ref={editorRef}
            onBlur={onBlur}
            className={styles.cellSelect}
            value={typeof value === 'string' ? value : row.priorityTier}
            onChange={(event) => setValue(event.target.value as DesignRequestPriorityTier)}
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
            {DESIGN_LIST_PRIORITY_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {formatTierLabel(tier)}
              </option>
            ))}
          </select>
        );
      }

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
    },
    commitEdit: persistCell,
    onCellActivated: async ({ trigger, key, beginEdit, seed }) => {
      if (key !== 'designer' && key !== 'design_ready' && key !== 'priority' && key !== 'notes') {
        return 'noop';
      }

      if (trigger === 'click' || trigger === 'enter' || trigger === 'double_click') {
        beginEdit();
        return 'handled';
      }

      if (trigger === 'printable' && seed && key === 'notes') {
        beginEdit(seed);
        return 'handled';
      }

      return 'noop';
    },
  };
}
