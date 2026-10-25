import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type MutableRefObject,type PointerEvent as ReactPointerEvent} from 'react';
import type {SpreadsheetActiveCell,SpreadsheetColumn,SpreadsheetDisplayColumn,SpreadsheetDisplayRow,SpreadsheetEditingCell,SpreadsheetGroup} from './types';
import {useSpreadsheetViewport} from './useSpreadsheetViewport';
const SHEET_LETTER_BAND_HEIGHT_PX=28;const SHEET_HEADER_HEIGHT_PX=54;const MIN_FILLER_ROWS=20;const FILLER_ROW_BUFFER_ROWS=12;
type UseSpreadsheetShellArgs<TRow, TKey extends string> = {
  columns: readonly SpreadsheetColumn<TKey>[];
  groups: readonly SpreadsheetGroup<TRow>[];
  rowNumberRows: readonly TRow[];
  zoomStorageKey: string;
  defaultActiveKey: TKey;
  getRowId: (row: TRow) => string;
  isRowSelectable?: (row: TRow) => boolean;
};

type UseSpreadsheetShellResult<TRow, TKey extends string> = {
  activeCell: SpreadsheetActiveCell<TKey> | null;
  setActiveCell: (cell: SpreadsheetActiveCell<TKey> | null) => void;
  displayColumns: SpreadsheetDisplayColumn<TKey>[];
  displayRows: SpreadsheetDisplayRow<TRow>[];
  visibleRows: TRow[];
  selectableRows: TRow[];
  gridRef: MutableRefObject<HTMLDivElement | null>;
  sheetViewportRef: MutableRefObject<HTMLDivElement | null>;
  setCellRef: (id: string, node: HTMLTableCellElement | null) => void;
  focusGrid: () => void;
  cellStyle: (column: SpreadsheetColumn<TKey>, index: number) => CSSProperties | undefined;
  rowNumberWidthPx: number;
  scaledPixels: (basePx: number) => number;
  sheetVars: CSSProperties;
  viewportProps: {
    onPointerEnter: () => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerLeave: () => void;
  };
  zoom: {
    value: number;
    presetValue: string;
    presets: readonly number[];
    min: number;
    max: number;
    step: number;
    setValue: (value: number) => void;
    stepBy: (direction: -1 | 1) => void;
    fitVisibleColumns: () => void;
    dockActive: boolean;
  };
};

export function useSpreadsheetRows<TRow,TKey extends string>({columns,groups,rowNumberRows,zoomStorageKey,defaultActiveKey,getRowId,isRowSelectable}:UseSpreadsheetShellArgs<TRow,TKey>, viewport:ReturnType<typeof useSpreadsheetViewport<TKey>>):UseSpreadsheetShellResult<TRow,TKey>{
  const selectable=isRowSelectable??(()=>true);
  const [activeCell,setActiveCell]=useState<SpreadsheetActiveCell<TKey>|null>(null);
  const initialRowsSelected=useRef(false);
  const preserveInitialViewport=useRef(false);
  const cellRefs=useRef(new Map<string,HTMLTableCellElement>());
  const {gridRef,sheetViewportRef,cellStyle,rowNumberWidthPx,scaledPixels,sheetVars,displayColumns,gridViewport,bodyRowHeightPx,groupRowHeightPx}=viewport;
  const visibleRows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const visibleGroupHeaderCount = useMemo(() => groups.filter((group) => group.showHeader !== false).length, [groups]);
  const selectableRows = useMemo(() => visibleRows.filter((row) => selectable(row)), [selectable, visibleRows]);
  const visibleRowIds = useMemo(() => new Set(selectableRows.map((row) => getRowId(row))), [getRowId, selectableRows]);
  const rowNumberByRowId = useMemo(
    () =>
      new Map(
        rowNumberRows.map((row, index) => [getRowId(row), index + 1]),
      ),
    [getRowId, rowNumberRows],
  );

  const fillerRowCount = useMemo(() => {
    const existingBodyHeight = visibleRows.length * bodyRowHeightPx + visibleGroupHeaderCount * groupRowHeightPx;
    const visibleViewportRows = Math.ceil(
      Math.max(0, gridViewport.height - scaledPixels(SHEET_LETTER_BAND_HEIGHT_PX) - scaledPixels(SHEET_HEADER_HEIGHT_PX) - existingBodyHeight) /
        Math.max(1, bodyRowHeightPx),
    );
    return Math.max(MIN_FILLER_ROWS, visibleViewportRows + FILLER_ROW_BUFFER_ROWS);
  }, [bodyRowHeightPx, gridViewport.height, groupRowHeightPx, scaledPixels, visibleGroupHeaderCount, visibleRows.length]);

  const displayRows = useMemo<SpreadsheetDisplayRow<TRow>[]>(
    () => [
      ...groups.flatMap<SpreadsheetDisplayRow<TRow>>((group) => [
        ...(group.showHeader === false ? [] : [{ kind: 'group', key: group.key, label: group.label } as const]),
        ...group.rows.map(
          (row): SpreadsheetDisplayRow<TRow> => ({
            kind: 'row',
            key: getRowId(row),
            row,
            rowNumber: rowNumberByRowId.get(getRowId(row)) ?? 0,
          }),
        ),
      ]),
      ...Array.from({ length: fillerRowCount }, (_, index): SpreadsheetDisplayRow<TRow> => ({ kind: 'filler', key: `filler_${index}` })),
    ],
    [fillerRowCount, getRowId, groups, rowNumberByRowId],
  );

  useEffect(() => {
    if (!selectableRows.length) {
      setActiveCell(null);
      return;
    }
    if (activeCell && visibleRowIds.has(activeCell.rowId)) return;
    if(!initialRowsSelected.current){
      initialRowsSelected.current=true;
      // Default selection must not undo reading/zoom positioning made on the
      // actual viewport before its first verified rows arrive.
      preserveInitialViewport.current=Boolean(gridRef.current?.scrollTop||gridRef.current?.scrollLeft);
    }
    setActiveCell({ rowId: getRowId(selectableRows[0]), key: defaultActiveKey });
  }, [activeCell, defaultActiveKey, getRowId, selectableRows, visibleRowIds]);

  useEffect(() => {
    if (!activeCell) return;
    if(preserveInitialViewport.current){preserveInitialViewport.current=false;return;}
    const node = cellRefs.current.get(`${activeCell.rowId}:${activeCell.key}`);
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeCell]);

  const setCellRef = useCallback((id: string, node: HTMLTableCellElement | null) => {
    if (!node) {
      cellRefs.current.delete(id);
      return;
    }
    cellRefs.current.set(id, node);
  }, []);

  return {...viewport,activeCell,setActiveCell,displayRows,visibleRows,selectableRows,setCellRef,focusGrid:()=>gridRef.current?.focus()};
}
export function useSpreadsheetShell<TRow,TKey extends string>(args:UseSpreadsheetShellArgs<TRow,TKey>):UseSpreadsheetShellResult<TRow,TKey>{
  const viewport=useSpreadsheetViewport(args.columns,args.zoomStorageKey);
  return useSpreadsheetRows(args,viewport);
}
export type SharedSpreadsheetEditingCell<TKey extends string,TValue>=SpreadsheetEditingCell<TKey,TValue>;
