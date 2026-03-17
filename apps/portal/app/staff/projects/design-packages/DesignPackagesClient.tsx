'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { ApiError } from '@/lib/repo/apiClient';
import { mutateDesignListCell } from '@/lib/repo/designPackagesRepo';
import { qk } from '@/lib/queries/keys';
import { designPackagesQueryOptions } from '@/lib/queries/designPackages';
import { DESIGN_LIST_COLUMNS, type DesignListColumnConfig } from '@/lib/designPackages/columns';
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
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import styles from '../running-jobs/running-jobs.module.css';

type ActiveCell = {
  requestId: string;
  key: DesignListCellKey;
};

type EditingCell = {
  requestId: string;
  key: DesignListEditableCellKey;
  value: NormalizedDesignListCellValue;
};

type Filters = {
  search: string;
  year: string;
  designerId: string;
  status: string;
  overdueOnly: boolean;
  showCompleted: boolean;
};

type SheetDisplayColumn =
  | {
      kind: 'actual';
      actualIndex: number;
      column: DesignListColumnConfig;
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
  | { kind: 'request'; row: DesignListRow; rowNumber: number }
  | { kind: 'filler'; key: string };

const DEFAULT_FILTERS: Filters = {
  search: '',
  year: 'all',
  designerId: 'all',
  status: 'all',
  overdueOnly: false,
  showCompleted: false,
};

const ALL_CELLS = DESIGN_LIST_COLUMNS.map((column) => column.key);
const DESIGN_LIST_STATUSES: readonly DesignRequestStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const DESIGN_LIST_PRIORITY_TIERS: readonly DesignRequestPriorityTier[] = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'UNPRICED'];
const TODAY_YMD = new Date().toISOString().slice(0, 10);
const SHEET_ZOOM_STORAGE_KEY = 'sp_design_list_sheet_zoom_v1';
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 200;
const SHEET_ZOOM_STEP = 5;
const SHEET_ZOOM_DEFAULT = 100;
const SHEET_ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const;
const SHEET_ROW_NUMBER_WIDTH_PX = 41;
const SHEET_LETTER_BAND_HEIGHT_PX = 28;
const SHEET_HEADER_HEIGHT_PX = 54;
const SHEET_PROJECT_ROW_HEIGHT_PX = 46;
const SHEET_TIER_ROW_HEIGHT_PX = 32;
const SHEET_FILLER_COLUMN_WIDTH_PX = 118;
const MIN_FILLER_COLUMNS = 18;
const MIN_FILLER_ROWS = 20;
const FILLER_COLUMN_BUFFER_COLUMNS = 12;
const FILLER_ROW_BUFFER_ROWS = 12;

function cellId(requestId: string, key: DesignListCellKey): string {
  return `${requestId}:${key}`;
}

function isEditableKey(key: DesignListCellKey): key is DesignListEditableCellKey {
  return DESIGN_LIST_COLUMNS.some((column) => column.key === key && column.editable);
}

function countRows(groups: Array<{ year: number; rows: DesignListRow[] }>): number {
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
    const column = DESIGN_LIST_COLUMNS[index];
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

function isPrintableKey(event: ReactKeyboardEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function isPresetZoom(value: number): boolean {
  return SHEET_ZOOM_PRESETS.includes(value as (typeof SHEET_ZOOM_PRESETS)[number]);
}

function setInRecord(record: Record<string, boolean>, key: string, value: boolean): Record<string, boolean> {
  if (value) return { ...record, [key]: true };
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function getRowClasses(row: DesignListRow): string {
  const classNames = [styles.row];
  if (row.status === 'IN_PROGRESS') classNames.push(styles.rowInProgress);
  if (row.status === 'DONE') classNames.push(styles.rowCompleted);
  if (row.status === 'CANCELLED') classNames.push(styles.rowLegacy);
  if (row.status === 'BLOCKED') classNames.push(styles.rowDeposit);
  return classNames.join(' ');
}

function getCellClasses(input: {
  row: DesignListRow;
  column: DesignListColumnConfig;
  active: boolean;
  editing: boolean;
  saving: boolean;
  conflict: boolean;
}): string {
  const classNames = [styles.bodyCell];
  if (input.column.frozen) classNames.push(styles.frozenCell);
  if (input.column.kind === 'notes') classNames.push(styles.notesCell);
  if (input.column.editable) classNames.push(styles.editableCell);
  if (input.column.source === 'quote') classNames.push(styles.estimateCell);
  if (input.column.source === 'visit') classNames.push(styles.scheduleCell);
  if (input.column.source === 'derived') classNames.push(styles.estimateCell);
  if (input.active) classNames.push(styles.activeCell);
  if (input.editing) classNames.push(styles.editingCell);
  if (input.saving) classNames.push(styles.savingCell);
  if (input.conflict) classNames.push(styles.conflictCell);
  if (input.column.key === 'design_ready' && isOverdue(input.row)) classNames.push(styles.overdueCell);
  if ((input.column.key === 'design_ready' && input.row.status === 'DONE') || (input.column.key === 'sent' && input.row.sentAt)) {
    classNames.push(styles.completeCell);
  }
  if ((input.column.key === 'design_ready' && input.row.status === 'BLOCKED') || (input.column.key === 'priority' && input.row.priorityTier === 'UNPRICED')) {
    classNames.push(styles.pendingCell);
  }
  return classNames.join(' ');
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

function cellStyle(column: DesignListColumnConfig, index: number, zoomPercent: number): CSSProperties | undefined {
  return column.frozen ? { left: stickyLeftFor(index, zoomPercent) } : undefined;
}

function buildDisplayRows(
  filteredGroups: Array<{ year: number; rows: DesignListRow[] }>,
  rowNumberByRequestId: Map<string, number>,
  fillerRowCount: number,
): SheetDisplayRow[] {
  const rows: SheetDisplayRow[] = [];
  for (const group of filteredGroups) {
    rows.push({ kind: 'year', year: group.year });
    for (const row of group.rows) {
      rows.push({
        kind: 'request',
        row,
        rowNumber: rowNumberByRequestId.get(row.requestId) ?? 0,
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
    ...DESIGN_LIST_COLUMNS.map(
      (column, actualIndex): SheetDisplayColumn => ({
        kind: 'actual',
        actualIndex,
        column,
        letter: column.letter,
        widthPx: column.widthPx,
      }),
    ),
    ...Array.from({ length: fillerColumnCount }, (_, fillerIndex): SheetDisplayColumn => {
      const actualIndex = DESIGN_LIST_COLUMNS.length + fillerIndex;
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

export default function DesignPackagesClient() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const host = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const queryKey = qk.designPackages.list(host);
  const query = useQuery(designPackagesQueryOptions(host));

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
    const message = query.error instanceof Error ? query.error.message : 'Failed to load design list.';
    toast.error(message);
  }, [query.error, toast]);

  const allRows = query.data?.rows ?? [];
  const lookups = query.data?.lookups ?? { designers: [] };
  const filteredGroups = useMemo(() => groupRowsByFilters(allRows, filters), [allRows, filters]);
  const visibleRows = useMemo(() => filteredGroups.flatMap((group) => group.rows), [filteredGroups]);
  const rowNumberByRequestId = useMemo(
    () =>
      new Map(
        allRows
          .slice()
          .sort(compareDesignListRows)
          .map((row, index) => [row.requestId, index + 1]),
      ),
    [allRows],
  );
  const rowsByRequestId = useMemo(() => new Map(allRows.map((row) => [row.requestId, row])), [allRows]);
  const visibleRequestIds = useMemo(() => new Set(visibleRows.map((row) => row.requestId)), [visibleRows]);

  const years = useMemo(
    () => Array.from(new Set(allRows.map((row) => String(yearForDesignListRow(row))))).sort(),
    [allRows],
  );
  const fillerColumnCount = useMemo(() => {
    const fillerWidth = scaledPixels(SHEET_FILLER_COLUMN_WIDTH_PX, zoomPercent);
    const visibleViewportColumns = Math.ceil(gridViewport.width / Math.max(1, fillerWidth));
    return Math.max(MIN_FILLER_COLUMNS, visibleViewportColumns + FILLER_COLUMN_BUFFER_COLUMNS);
  }, [gridViewport.width, zoomPercent]);
  const requestRowHeightPx = useMemo(() => scaledPixels(SHEET_PROJECT_ROW_HEIGHT_PX, zoomPercent), [zoomPercent]);
  const tierRowHeightPx = useMemo(() => scaledPixels(SHEET_TIER_ROW_HEIGHT_PX, zoomPercent), [zoomPercent]);
  const fillerRowCount = useMemo(() => {
    const existingBodyHeight = visibleRows.length * requestRowHeightPx + filteredGroups.length * tierRowHeightPx;
    const visibleViewportRows = Math.ceil(
      Math.max(
        0,
        gridViewport.height - scaledPixels(SHEET_LETTER_BAND_HEIGHT_PX, zoomPercent) - scaledPixels(SHEET_HEADER_HEIGHT_PX, zoomPercent) - existingBodyHeight,
      ) / Math.max(1, requestRowHeightPx),
    );
    return Math.max(MIN_FILLER_ROWS, visibleViewportRows + FILLER_ROW_BUFFER_ROWS);
  }, [filteredGroups.length, gridViewport.height, requestRowHeightPx, tierRowHeightPx, visibleRows.length, zoomPercent]);
  const displayColumns = useMemo(() => buildDisplayColumns(fillerColumnCount), [fillerColumnCount]);
  const displayRows = useMemo(() => buildDisplayRows(filteredGroups, rowNumberByRequestId, fillerRowCount), [filteredGroups, fillerRowCount, rowNumberByRequestId]);
  const zoomPresetValue = isPresetZoom(zoomPercent) ? String(zoomPercent) : String(zoomPercent);
  const sheetVars = useMemo(
    () =>
      ({
        '--sheet-scale': String(zoomPercent / 100),
        '--sheet-row-number-width': `${rowNumberWidthPx(zoomPercent)}px`,
        '--sheet-letter-band-height': `${scaledPixels(SHEET_LETTER_BAND_HEIGHT_PX, zoomPercent)}px`,
        '--sheet-header-height': `${scaledPixels(SHEET_HEADER_HEIGHT_PX, zoomPercent)}px`,
        '--sheet-row-height': `${requestRowHeightPx}px`,
        '--sheet-year-row-height': `${tierRowHeightPx}px`,
      }) as CSSProperties,
    [requestRowHeightPx, tierRowHeightPx, zoomPercent],
  );

  useEffect(() => {
    if (!visibleRows.length) {
      setActiveCell(null);
      setEditing(null);
      return;
    }
    if (activeCell && visibleRequestIds.has(activeCell.requestId)) return;
    setActiveCell({ requestId: visibleRows[0].requestId, key: 'quote_name' });
  }, [activeCell, visibleRequestIds, visibleRows]);

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
    const node = cellRefs.current.get(cellId(activeCell.requestId, activeCell.key));
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

  const updateZoomPercent = useCallback(
    (value: number) => {
      revealZoomDock();
      setZoomPercent(clampSheetZoomPercent(value));
    },
    [revealZoomDock],
  );

  const handleZoomStep = useCallback(
    (direction: -1 | 1) => {
      updateZoomPercent(zoomPercent + direction * SHEET_ZOOM_STEP);
    },
    [updateZoomPercent, zoomPercent],
  );

  const handleFitVisibleColumns = useCallback(() => {
    if (!gridViewport.width) return;
    const actualColumnsWidthPx = DESIGN_LIST_COLUMNS.reduce((sum, column) => sum + column.widthPx, 0);
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

      const id = cellId(row.requestId, key);
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
        const response = await mutateDesignListCell({
          requestId: row.requestId,
          rowVersion: row.rowVersion,
          key,
          value: normalized.value,
        });

        queryClient.setQueryData<DesignPackagesResponse>(queryKey, (current) =>
          current
            ? {
                ...current,
                generatedAt: new Date().toISOString(),
                rows: updateDesignListRow(current.rows, response.updatedRow.requestId, () => response.updatedRow),
              }
            : current,
        );

        void queryClient.invalidateQueries({ queryKey: qk.projects.detail(host, row.projectId) });
        void queryClient.invalidateQueries({ queryKey: qk.projects.snapshot(host, row.projectId) });
        void queryClient.invalidateQueries({ queryKey: qk.automation.designTicket(host, row.projectId) });
        void queryClient.invalidateQueries({ queryKey: qk.automation.tasks(host, row.projectId) });
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const currentRow = (error.body as any)?.currentRow as DesignListRow | undefined;
          if (currentRow && previous) {
            queryClient.setQueryData<DesignPackagesResponse>(queryKey, {
              ...previous,
              generatedAt: new Date().toISOString(),
              rows: updateDesignListRow(previous.rows, currentRow.requestId, () => currentRow),
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
      const rowIndex = visibleRows.findIndex((row) => row.requestId === activeCell.requestId);
      const columnIndex = ALL_CELLS.indexOf(activeCell.key);
      const nextRow = visibleRows[Math.max(0, Math.min(visibleRows.length - 1, rowIndex + rowDelta))];
      const nextColumn = ALL_CELLS[Math.max(0, Math.min(ALL_CELLS.length - 1, columnIndex + columnDelta))] ?? activeCell.key;
      setActiveCell({ requestId: nextRow.requestId, key: nextColumn });
    },
    [activeCell, visibleRows],
  );

  const beginEdit = useCallback(
    (row: DesignListRow, key: DesignListCellKey, seeded?: string) => {
      if (!isEditableKey(key)) return;
      const editability = getDesignListCellEditability(row, key);
      if (!editability.editable) {
        toast.error(editability.reason ?? 'This cell cannot be edited right now.');
        return;
      }

      const initialValue = seeded !== undefined ? seeded : getDesignListEditorValue(row, key);
      setEditing({
        requestId: row.requestId,
        key,
        value: seeded !== undefined ? seeded : initialValue,
      });
    },
    [toast],
  );

  const commitEditing = useCallback(
    async (nextSelection?: ActiveCell | null): Promise<boolean> => {
      if (!editing) return true;
      const row = rowsByRequestId.get(editing.requestId);
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
    [editing, persistCell, rowsByRequestId],
  );

  const handleGridKeyDown = useCallback(
    async (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!activeCell) return;
      if (editing) return;

      const row = rowsByRequestId.get(activeCell.requestId);
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
        if (isEditableKey(activeCell.key)) beginEdit(row, activeCell.key);
        return;
      }
      if (isPrintableKey(event) && isEditableKey(activeCell.key) && activeCell.key === 'notes') {
        event.preventDefault();
        beginEdit(row, activeCell.key, event.key);
      }
    },
    [activeCell, beginEdit, editing, moveActiveCell, rowsByRequestId],
  );

  const renderEditor = useCallback(
    (row: DesignListRow, key: DesignListEditableCellKey) => {
      if (!editing || editing.requestId !== row.requestId || editing.key !== key) return null;

      const commitToNeighbor = async (columnDelta: number) => {
        const rowIndex = visibleRows.findIndex((item) => item.requestId === row.requestId);
        const columnIndex = ALL_CELLS.indexOf(key);
        const nextRow = visibleRows[Math.max(0, rowIndex)];
        const nextColumn = ALL_CELLS[Math.max(0, Math.min(ALL_CELLS.length - 1, columnIndex + columnDelta))] ?? key;
        await commitEditing({ requestId: nextRow.requestId, key: nextColumn });
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
        if (event.key === 'Enter' && key !== 'notes') {
          event.preventDefault();
          await commitEditing();
          return;
        }
        if (event.key === 'Enter' && key === 'notes' && !event.shiftKey) {
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

      if (key === 'design_ready') {
        return (
          <select
            {...commonProps}
            className={styles.cellSelect}
            value={typeof editing.value === 'string' ? editing.value : row.status}
            onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: event.target.value as DesignRequestStatus } : prev))}
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
            {...commonProps}
            className={styles.cellSelect}
            value={typeof editing.value === 'string' ? editing.value : row.priorityTier}
            onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: event.target.value as DesignRequestPriorityTier } : prev))}
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
          {...commonProps}
          className={styles.notesEditor}
          rows={4}
          value={typeof editing.value === 'string' ? editing.value : ''}
          onChange={(event) => setEditing((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
          onKeyDown={onTextKeyDown}
        />
      );
    },
    [commitEditing, editing, visibleRows],
  );

  return (
    <main className={styles.page}>
      <PageHeader title="Design List" />

      <div className={styles.stack}>
        <section className={styles.section}>
          <Toolbar
            filters={filters}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            years={years}
            designers={lookups.designers}
            totalRows={allRows.length}
            visibleRows={countRows(filteredGroups)}
            generatedAt={query.data?.generatedAt ?? null}
          />

          {query.isLoading && !query.data ? (
            <div className={styles.emptyState}>Loading design list...</div>
          ) : query.error && !query.data ? (
            <div className={styles.emptyState}>Could not load design list.</div>
          ) : !visibleRows.length ? (
            <div className={styles.emptyTable}>No matching requests.</div>
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
                              {column.column.source !== 'request' ? <span className={styles.headerSource}>{column.column.source}</span> : null}
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
                      return (
                        <tr key={row.requestId} className={getRowClasses(row)}>
                          <th className={styles.rowNumberCell} scope="row">
                            {rowNumber}
                          </th>
                          {displayColumns.map((displayColumn) => {
                            if (displayColumn.kind === 'filler') {
                              return <td key={`${row.requestId}_${displayColumn.key}`} className={`${styles.bodyCell} ${styles.fillerCell}`} />;
                            }

                            const column = displayColumn.column;
                            const id = cellId(row.requestId, column.key);
                            const isActive = activeCell?.requestId === row.requestId && activeCell?.key === column.key;
                            const isEditing = editing?.requestId === row.requestId && editing?.key === column.key;
                            const text = formatCellValue(row, column.key);

                            const content =
                              column.key === 'quote_name' ? (
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
                              ) : column.key === 'notes' ? (
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
                                  setActiveCell({ requestId: row.requestId, key: column.key });
                                  gridRef.current?.focus();
                                }}
                                onDoubleClick={() => {
                                  if (!isEditableKey(column.key)) return;
                                  beginEdit(row, column.key);
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
