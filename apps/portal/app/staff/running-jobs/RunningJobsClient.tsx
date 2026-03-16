'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
  RunningJobRowSource,
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

type SheetDisplayColumn =
  | {
      kind: 'actual';
      actualIndex: number;
      column: RunningJobsColumnConfig;
      letter: string;
      widthPx: number;
    }
  | {
      kind: 'filler';
      actualIndex: number;
      key: string;
      letter: string;
      widthPx: number;
    };

type SheetDisplayRow =
  | { kind: 'year'; year: number }
  | { kind: 'project'; row: RunningJobRow; rowNumber: number; source: RunningJobRowSource }
  | { kind: 'filler'; key: string };

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
const SHEET_ZOOM_STORAGE_KEY = 'sp_running_jobs_sheet_zoom_v1';
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 200;
const SHEET_ZOOM_STEP = 5;
const SHEET_ZOOM_DEFAULT = 100;
const SHEET_ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const;
const SHEET_ROW_NUMBER_WIDTH_PX = 41;
const SHEET_LETTER_BAND_HEIGHT_PX = 28;
const SHEET_HEADER_HEIGHT_PX = 54;
const SHEET_PROJECT_ROW_HEIGHT_PX = 46;
const SHEET_YEAR_ROW_HEIGHT_PX = 32;
const SHEET_FILLER_COLUMN_WIDTH_PX = 118;
const MIN_FILLER_COLUMNS = 18;
const MIN_FILLER_ROWS = 20;
const FILLER_COLUMN_BUFFER_COLUMNS = 12;
const FILLER_ROW_BUFFER_ROWS = 12;

function cellId(projectId: string, key: RunningJobCellKey): string {
  return `${projectId}:${key}`;
}

function isEditableKey(key: RunningJobCellKey): key is RunningJobEditableCellKey {
  return RUNNING_JOBS_COLUMNS.some((column) => column.key === key && column.editable);
}

function countRows(groups: RunningJobsResponse['groups']): number {
  return groups.reduce((sum, group) => sum + group.rows.length, 0);
}

function clampSheetZoomPercent(value: number): number {
  if (!Number.isFinite(value)) return SHEET_ZOOM_DEFAULT;
  return Math.max(SHEET_ZOOM_MIN, Math.min(SHEET_ZOOM_MAX, Math.round(value)));
}

function readSheetZoomPreference(): number {
  if (typeof window === 'undefined') return SHEET_ZOOM_DEFAULT;
  try {
    const raw = window.localStorage.getItem(SHEET_ZOOM_STORAGE_KEY);
    if (!raw) return SHEET_ZOOM_DEFAULT;
    return clampSheetZoomPercent(Number.parseInt(raw, 10));
  } catch {
    return SHEET_ZOOM_DEFAULT;
  }
}

function writeSheetZoomPreference(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHEET_ZOOM_STORAGE_KEY, String(clampSheetZoomPercent(value)));
  } catch {
    // ignore storage failures
  }
}

function scaledPixels(basePx: number, zoomPercent: number): number {
  return Math.max(1, Math.round((basePx * zoomPercent) / 100));
}

function rowNumberWidthPx(zoomPercent: number): number {
  return scaledPixels(SHEET_ROW_NUMBER_WIDTH_PX, zoomPercent);
}

function stickyLeftFor(columnIndex: number, zoomPercent: number): number {
  let left = rowNumberWidthPx(zoomPercent);
  for (let index = 0; index < columnIndex; index += 1) {
    const column = RUNNING_JOBS_COLUMNS[index];
    if (column?.frozen) left += scaledPixels(column.widthPx, zoomPercent);
  }
  return left;
}

function toExcelColumnLetter(index: number): string {
  let next = index + 1;
  let out = '';
  while (next > 0) {
    const remainder = (next - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    next = Math.floor((next - 1) / 26);
  }
  return out;
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

function isLegacySheetRow(row: RunningJobRow): boolean {
  return row.source === 'legacy';
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

function isPresetZoom(value: number): boolean {
  return SHEET_ZOOM_PRESETS.includes(value as (typeof SHEET_ZOOM_PRESETS)[number]);
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
  if (isLegacySheetRow(input.row)) classNames.push(styles.legacyCell);
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
  if (isLegacySheetRow(row)) classNames.push(styles.rowLegacy);
  if (row.stage === 'DEPOSIT' && !row.state.hasCrewAssigned && !row.state.hasEstimatedStartDate) classNames.push(styles.rowDeposit);
  if (isInProgress(row)) classNames.push(styles.rowInProgress);
  if (row.stage === 'COMPLETED') classNames.push(styles.rowCompleted);
  if (row.stage === 'PAID') classNames.push(styles.rowPaid);
  return classNames.join(' ');
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

function cellStyle(column: RunningJobsColumnConfig, index: number, zoomPercent: number): React.CSSProperties | undefined {
  return column.frozen ? { left: stickyLeftFor(index, zoomPercent) } : undefined;
}

function buildDisplayRows(filteredGroups: RunningJobsResponse['groups'], rowNumberByProjectId: Map<string, number>, fillerRowCount: number): SheetDisplayRow[] {
  const rows: SheetDisplayRow[] = [];
  for (const group of filteredGroups) {
    rows.push({ kind: 'year', year: group.year });
    for (const row of group.rows) {
      rows.push({
        kind: 'project',
        row,
        rowNumber: rowNumberByProjectId.get(row.projectId) ?? 0,
        source: row.source,
      });
    }
  }
  for (let index = 0; index < fillerRowCount; index += 1) {
    rows.push({ kind: 'filler', key: `filler_${index}` });
  }
  return rows;
}

function buildDisplayColumns(fillerColumnCount: number): SheetDisplayColumn[] {
  return [
    ...RUNNING_JOBS_COLUMNS.map(
      (column, actualIndex): SheetDisplayColumn => ({
        kind: 'actual',
        actualIndex,
        column,
        letter: column.letter,
        widthPx: column.widthPx,
      }),
    ),
    ...Array.from({ length: fillerColumnCount }, (_, fillerIndex): SheetDisplayColumn => {
      const actualIndex = RUNNING_JOBS_COLUMNS.length + fillerIndex;
      return {
        kind: 'filler',
        actualIndex,
        key: `filler_col_${fillerIndex}`,
        letter: toExcelColumnLetter(actualIndex),
        widthPx: SHEET_FILLER_COLUMN_WIDTH_PX,
      };
    }),
  ];
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
  const [zoomPercent, setZoomPercent] = useState<number>(() => readSheetZoomPreference());
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [conflictCells, setConflictCells] = useState<Record<string, boolean>>({});
  const [gridViewport, setGridViewport] = useState({ width: 0, height: 0 });

  const sheetViewportRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const skipBlurCommitRef = useRef(false);
  const zoomDockTimeoutRef = useRef<number | null>(null);
  const [zoomDockVisible, setZoomDockVisible] = useState(false);
  const [zoomDockHoverVisible, setZoomDockHoverVisible] = useState(false);
  const sheetGestureArmedRef = useRef(false);

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
  const selectableRows = useMemo(() => visibleRows.filter((row) => !isLegacySheetRow(row)), [visibleRows]);
  const rowNumberByProjectId = useMemo(() => new Map(allRows.map((row, index) => [row.projectId, index + 1])), [allRows]);
  const rowsByProjectId = useMemo(() => new Map(allRows.map((row) => [row.projectId, row])), [allRows]);
  const visibleProjectIds = useMemo(() => new Set(selectableRows.map((row) => row.projectId)), [selectableRows]);

  const years = useMemo(
    () => Array.from(new Set(allRows.map((row) => rowYearValue(row)))).filter(Boolean).sort().reverse(),
    [allRows],
  );
  const stages = useMemo(() => Array.from(new Set(allRows.map((row) => row.stage).filter((stage) => stage !== 'LEGACY'))).sort(), [allRows]);
  const fillerColumnCount = useMemo(() => {
    const fillerWidth = scaledPixels(SHEET_FILLER_COLUMN_WIDTH_PX, zoomPercent);
    const visibleViewportColumns = Math.ceil(gridViewport.width / Math.max(1, fillerWidth));
    return Math.max(MIN_FILLER_COLUMNS, visibleViewportColumns + FILLER_COLUMN_BUFFER_COLUMNS);
  }, [gridViewport.width, zoomPercent]);
  const projectRowHeightPx = useMemo(() => scaledPixels(SHEET_PROJECT_ROW_HEIGHT_PX, zoomPercent), [zoomPercent]);
  const yearRowHeightPx = useMemo(() => scaledPixels(SHEET_YEAR_ROW_HEIGHT_PX, zoomPercent), [zoomPercent]);
  const fillerRowCount = useMemo(() => {
    const existingBodyHeight = visibleRows.length * projectRowHeightPx + filteredGroups.length * yearRowHeightPx;
    const visibleViewportRows = Math.ceil(
      Math.max(
        0,
        gridViewport.height - scaledPixels(SHEET_LETTER_BAND_HEIGHT_PX, zoomPercent) - scaledPixels(SHEET_HEADER_HEIGHT_PX, zoomPercent) - existingBodyHeight,
      ) / Math.max(1, projectRowHeightPx),
    );
    return Math.max(MIN_FILLER_ROWS, visibleViewportRows + FILLER_ROW_BUFFER_ROWS);
  }, [filteredGroups.length, gridViewport.height, projectRowHeightPx, visibleRows.length, yearRowHeightPx, zoomPercent]);
  const displayColumns = useMemo(() => buildDisplayColumns(fillerColumnCount), [fillerColumnCount]);
  const displayRows = useMemo(() => buildDisplayRows(filteredGroups, rowNumberByProjectId, fillerRowCount), [filteredGroups, fillerRowCount, rowNumberByProjectId]);
  const zoomPresetValue = isPresetZoom(zoomPercent) ? String(zoomPercent) : String(zoomPercent);
  const sheetVars = useMemo(
    () =>
      ({
        '--sheet-scale': String(zoomPercent / 100),
        '--sheet-row-number-width': `${rowNumberWidthPx(zoomPercent)}px`,
        '--sheet-letter-band-height': `${scaledPixels(SHEET_LETTER_BAND_HEIGHT_PX, zoomPercent)}px`,
        '--sheet-header-height': `${scaledPixels(SHEET_HEADER_HEIGHT_PX, zoomPercent)}px`,
        '--sheet-row-height': `${projectRowHeightPx}px`,
        '--sheet-year-row-height': `${yearRowHeightPx}px`,
      }) as React.CSSProperties,
    [projectRowHeightPx, yearRowHeightPx, zoomPercent],
  );

  useEffect(() => {
    if (!selectableRows.length) {
      setActiveCell(null);
      setEditing(null);
      return;
    }
    if (activeCell && visibleProjectIds.has(activeCell.projectId)) return;
    setActiveCell({ projectId: selectableRows[0].projectId, key: 'client_name' });
  }, [activeCell, selectableRows, visibleProjectIds]);

  useEffect(() => {
    writeSheetZoomPreference(zoomPercent);
  }, [zoomPercent]);

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

  useEffect(() => {
    const node = gridRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      setGridViewport({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  const revealZoomDock = useCallback((durationMs = 1500) => {
    setZoomDockVisible(true);
    if (zoomDockTimeoutRef.current !== null) {
      window.clearTimeout(zoomDockTimeoutRef.current);
      zoomDockTimeoutRef.current = null;
    }
    zoomDockTimeoutRef.current = window.setTimeout(() => {
      setZoomDockVisible(false);
      zoomDockTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (zoomDockTimeoutRef.current !== null) {
        window.clearTimeout(zoomDockTimeoutRef.current);
      }
    };
  }, []);

  const updateZoomPercent = useCallback((value: number) => {
    revealZoomDock();
    setZoomPercent(clampSheetZoomPercent(value));
  }, [revealZoomDock]);

  const handleZoomStep = useCallback(
    (direction: -1 | 1) => {
      updateZoomPercent(zoomPercent + direction * SHEET_ZOOM_STEP);
    },
    [updateZoomPercent, zoomPercent],
  );

  const handleFitVisibleColumns = useCallback(() => {
    if (!gridViewport.width) return;
    const actualColumnsWidthPx = RUNNING_JOBS_COLUMNS.reduce((sum, column) => sum + column.widthPx, 0);
    const next = clampSheetZoomPercent((gridViewport.width / Math.max(1, SHEET_ROW_NUMBER_WIDTH_PX + actualColumnsWidthPx)) * 100);
    revealZoomDock();
    setZoomPercent(next);
  }, [gridViewport.width, revealZoomDock]);

  const handleSheetViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    sheetGestureArmedRef.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const nearBottomRight = rect.right - event.clientX <= 360 && rect.bottom - event.clientY <= 148;
    setZoomDockHoverVisible((prev) => (prev === nearBottomRight ? prev : nearBottomRight));
  }, []);

  useEffect(() => {
    const viewportNode = sheetViewportRef.current;
    if (!viewportNode) return;

    let lastGestureScale = 1;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      revealZoomDock();
      setZoomPercent((prev) => clampSheetZoomPercent(prev - event.deltaY / 12));
    };

    const onGestureStart = (event: Event) => {
      const gestureEvent = event as Event & { scale?: number; preventDefault: () => void };
      gestureEvent.preventDefault();
      lastGestureScale = typeof gestureEvent.scale === 'number' && Number.isFinite(gestureEvent.scale) ? gestureEvent.scale : 1;
    };

    const onGestureChange = (event: Event) => {
      const gestureEvent = event as Event & { scale?: number; preventDefault: () => void };
      gestureEvent.preventDefault();
      const scale = typeof gestureEvent.scale === 'number' && Number.isFinite(gestureEvent.scale) ? gestureEvent.scale : lastGestureScale;
      if (!Number.isFinite(scale) || scale <= 0) return;
      const factor = scale / Math.max(0.0001, lastGestureScale);
      lastGestureScale = scale;
      revealZoomDock();
      setZoomPercent((prev) => clampSheetZoomPercent(prev * factor));
    };

    const onDocumentGestureStart = (event: Event) => {
      if (!sheetGestureArmedRef.current) return;
      onGestureStart(event);
    };

    const onDocumentGestureChange = (event: Event) => {
      if (!sheetGestureArmedRef.current) return;
      onGestureChange(event);
    };

    viewportNode.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('gesturestart', onDocumentGestureStart as EventListener, { passive: false } as AddEventListenerOptions);
    document.addEventListener('gesturechange', onDocumentGestureChange as EventListener, { passive: false } as AddEventListenerOptions);

    return () => {
      viewportNode.removeEventListener('wheel', onWheel);
      document.removeEventListener('gesturestart', onDocumentGestureStart as EventListener);
      document.removeEventListener('gesturechange', onDocumentGestureChange as EventListener);
    };
  }, [revealZoomDock]);

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
      if (!activeCell || !selectableRows.length) return;
      const rowIndex = selectableRows.findIndex((row) => row.projectId === activeCell.projectId);
      const columnIndex = ALL_CELLS.indexOf(activeCell.key);
      const nextRow = selectableRows[Math.max(0, Math.min(selectableRows.length - 1, rowIndex + rowDelta))];
      const nextColumn = ALL_CELLS[Math.max(0, Math.min(ALL_CELLS.length - 1, columnIndex + columnDelta))] ?? activeCell.key;
      setActiveCell({ projectId: nextRow.projectId, key: nextColumn });
    },
    [activeCell, selectableRows],
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
        const rowIndex = selectableRows.findIndex((item) => item.projectId === row.projectId);
        const columnIndex = ALL_CELLS.indexOf(key);
        const nextRow = selectableRows[Math.max(0, rowIndex)];
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
    [commitEditing, editing, lookups.crews, lookups.salesPeople, selectableRows],
  );

  return (
    <main className={styles.page}>
      <PageHeader title="Running Jobs" />

      <div className={styles.stack}>
        <section className={styles.section}>
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
            <div
              ref={sheetViewportRef}
              className={styles.sheetViewport}
              onPointerEnter={() => {
                sheetGestureArmedRef.current = true;
              }}
              onPointerMove={handleSheetViewportPointerMove}
              onPointerLeave={() => {
                sheetGestureArmedRef.current = false;
                setZoomDockHoverVisible(false);
              }}
            >
              <div ref={gridRef} className={styles.tableScroller} style={sheetVars} tabIndex={0} onKeyDown={handleGridKeyDown}>
                <table className={styles.table}>
                  <colgroup>
                    <col style={{ width: rowNumberWidthPx(zoomPercent) }} />
                    {displayColumns.map((column) => (
                      <col key={column.kind === 'actual' ? column.column.key : column.key} style={{ width: scaledPixels(column.widthPx, zoomPercent) }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className={styles.letterRow}>
                      <th className={`${styles.cornerCell} ${styles.rowNumberBandCell}`} />
                      {displayColumns.map((column) => (
                        <th
                          key={column.kind === 'actual' ? `${column.column.key}_letter` : `${column.key}_letter`}
                          className={`${styles.letterCell} ${column.kind === 'actual' && column.column.frozen ? styles.frozenLetterCell : ''}`}
                          style={column.kind === 'actual' ? cellStyle(column.column, column.actualIndex, zoomPercent) : undefined}
                          scope="col"
                        >
                          {column.letter}
                        </th>
                      ))}
                    </tr>
                    <tr className={styles.labelsRow}>
                      <th className={`${styles.rowNumberHeaderCell} ${styles.rowNumberBandCell}`} />
                      {displayColumns.map((column) => (
                        <th
                          key={column.kind === 'actual' ? `${column.column.key}_header` : `${column.key}_header`}
                          className={
                            column.kind === 'actual'
                              ? `${styles.headerCell} ${column.column.frozen ? styles.frozenHeaderCell : ''}`
                              : styles.fillerHeaderCell
                          }
                          style={column.kind === 'actual' ? cellStyle(column.column, column.actualIndex, zoomPercent) : undefined}
                          scope="col"
                        >
                          {column.kind === 'actual' ? (
                            <>
                              <span className={styles.headerLabel}>{column.column.label}</span>
                              {column.column.source === 'estimate' ? <span className={styles.headerSource}>Estimate</span> : null}
                              {column.column.source === 'schedule' ? <span className={styles.headerSource}>Schedule</span> : null}
                            </>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((displayRow) => {
                      if (displayRow.kind === 'year') {
                        return (
                          <tr key={`year_${displayRow.year}`} className={styles.yearDividerRow}>
                            <th className={`${styles.rowNumberCell} ${styles.rowNumberBlankCell}`} />
                            <th className={styles.yearRow} colSpan={displayColumns.length} scope="rowgroup">
                              {displayRow.year}
                            </th>
                          </tr>
                        );
                      }

                      if (displayRow.kind === 'filler') {
                        return (
                          <tr key={displayRow.key} className={styles.fillerRow}>
                            <th className={`${styles.rowNumberCell} ${styles.rowNumberBlankCell}`} />
                            {displayColumns.map((column) => (
                              <td
                                key={column.kind === 'actual' ? `${displayRow.key}_${column.column.key}` : `${displayRow.key}_${column.key}`}
                                className={`${styles.bodyCell} ${styles.fillerCell} ${
                                  column.kind === 'actual' && column.column.frozen ? styles.frozenFillerCell : ''
                                }`}
                                style={column.kind === 'actual' ? cellStyle(column.column, column.actualIndex, zoomPercent) : undefined}
                              />
                            ))}
                          </tr>
                        );
                      }

                      const { row, rowNumber } = displayRow;
                      const isLegacyRow = isLegacySheetRow(row);
                      return (
                        <tr key={row.projectId} className={getRowClasses(row)}>
                          <th className={styles.rowNumberCell} scope="row">
                            {rowNumber}
                          </th>
                          {displayColumns.map((displayColumn) => {
                            if (displayColumn.kind === 'filler') {
                              return <td key={`${row.projectId}_${displayColumn.key}`} className={`${styles.bodyCell} ${styles.fillerCell}`} />;
                            }

                            const column = displayColumn.column;
                            const id = cellId(row.projectId, column.key);
                            const isActive = activeCell?.projectId === row.projectId && activeCell?.key === column.key;
                            const isEditing = editing?.projectId === row.projectId && editing?.key === column.key;
                            const text = formatCellValue(row, column.key);

                            const content =
                              column.key === 'client_name' ? (
                                <div className={styles.clientCell}>
                                  <span>{text || 'Untitled'}</span>
                                  {isLegacyRow ? <span className={styles.projectLinkMuted}>Legacy</span> : null}
                                  {!isLegacyRow ? (
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
                                style={cellStyle(column, displayColumn.actualIndex, zoomPercent)}
                                onClick={() => {
                                  if (isLegacyRow) return;
                                  setActiveCell({ projectId: row.projectId, key: column.key });
                                  gridRef.current?.focus();
                                }}
                                onDoubleClick={() => {
                                  if (isLegacyRow) return;
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={styles.zoomDockLayer} data-active={zoomDockVisible || zoomDockHoverVisible ? 'true' : 'false'}>
                <div className={styles.zoomDock} aria-label="Sheet zoom controls">
                  <button type="button" className={styles.zoomButton} onClick={() => handleZoomStep(-1)} aria-label="Zoom out">
                    -
                  </button>
                  <input
                    className={styles.zoomSlider}
                    type="range"
                    min={SHEET_ZOOM_MIN}
                    max={SHEET_ZOOM_MAX}
                    step={SHEET_ZOOM_STEP}
                    value={zoomPercent}
                    onChange={(event) => updateZoomPercent(Number.parseInt(event.target.value, 10))}
                    aria-label="Sheet zoom"
                  />
                  <button type="button" className={styles.zoomButton} onClick={() => handleZoomStep(1)} aria-label="Zoom in">
                    +
                  </button>
                  <select
                    className={styles.zoomPreset}
                    value={zoomPresetValue}
                    onChange={(event) => updateZoomPercent(Number.parseInt(event.target.value, 10))}
                    aria-label="Zoom preset"
                  >
                    {SHEET_ZOOM_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}%
                      </option>
                    ))}
                    {!isPresetZoom(zoomPercent) ? <option value={zoomPercent}>{zoomPercent}%</option> : null}
                  </select>
                  <button type="button" className={styles.fitButton} onClick={handleFitVisibleColumns}>
                    Fit visible columns
                  </button>
                  <span className={styles.zoomValue}>{zoomPercent}%</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
