import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent} from 'react';
import type {SpreadsheetColumn,SpreadsheetDisplayColumn} from './types';
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 200;
const SHEET_ZOOM_STEP = 5;
const SHEET_ZOOM_DEFAULT = 100;
const SHEET_ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const;
const SHEET_ROW_NUMBER_WIDTH_PX = 41;
const SHEET_LETTER_BAND_HEIGHT_PX = 28;
const SHEET_HEADER_HEIGHT_PX = 54;
const SHEET_BODY_ROW_HEIGHT_PX = 46;
const SHEET_GROUP_ROW_HEIGHT_PX = 32;
const SHEET_FILLER_COLUMN_WIDTH_PX = 118;
const MIN_FILLER_COLUMNS = 18;
const MIN_FILLER_ROWS = 20;
const FILLER_COLUMN_BUFFER_COLUMNS = 12;
const FILLER_ROW_BUFFER_ROWS = 12;

function clampSheetZoomPercent(value: number): number {
  if (!Number.isFinite(value)) return SHEET_ZOOM_DEFAULT;
  return Math.max(SHEET_ZOOM_MIN, Math.min(SHEET_ZOOM_MAX, Math.round(value)));
}

function readSheetZoomPreference(storageKey: string): number {
  if (typeof window === 'undefined') return SHEET_ZOOM_DEFAULT;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return SHEET_ZOOM_DEFAULT;
    return clampSheetZoomPercent(Number.parseInt(raw, 10));
  } catch {
    return SHEET_ZOOM_DEFAULT;
  }
}

function writeSheetZoomPreference(storageKey: string, value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, String(clampSheetZoomPercent(value)));
  } catch {
    // ignore storage failures
  }
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

export function useSpreadsheetViewport<TKey extends string>(columns:readonly SpreadsheetColumn<TKey>[],zoomStorageKey:string,active=true){
  const [zoomPercent, setZoomPercent] = useState<number>(() => readSheetZoomPreference(zoomStorageKey));
  const [preferenceKey,setPreferenceKey]=useState(zoomStorageKey);
  if(preferenceKey!==zoomStorageKey){setPreferenceKey(zoomStorageKey);setZoomPercent(readSheetZoomPreference(zoomStorageKey));}
  const [gridViewport, setGridViewport] = useState({ width: 0, height: 0 });
  const [zoomDockVisible, setZoomDockVisible] = useState(false);
  const [zoomDockHoverVisible, setZoomDockHoverVisible] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const sheetViewportRef = useRef<HTMLDivElement | null>(null);
  const zoomDockTimeoutRef = useRef<number | null>(null);
  const sheetGestureArmedRef = useRef(false);

  const scaledPixels = useCallback((basePx: number) => Math.max(1, Math.round((basePx * zoomPercent) / 100)), [zoomPercent]);
  const rowNumberWidthPx = scaledPixels(SHEET_ROW_NUMBER_WIDTH_PX);

  const stickyLeftFor = useCallback(
    (columnIndex: number) => {
      let left = rowNumberWidthPx;
      for (let index = 0; index < columnIndex; index += 1) {
        const column = columns[index];
        if (column?.frozen) left += scaledPixels(column.widthPx);
      }
      return left;
    },
    [columns, rowNumberWidthPx, scaledPixels],
  );

  const cellStyle = useCallback(
    (column: SpreadsheetColumn<TKey>, index: number): CSSProperties | undefined => (column.frozen ? { left: stickyLeftFor(index) } : undefined),
    [stickyLeftFor],
  );

  const fillerColumnCount = useMemo(() => {
    const fillerWidth = scaledPixels(SHEET_FILLER_COLUMN_WIDTH_PX);
    const visibleViewportColumns = Math.ceil(gridViewport.width / Math.max(1, fillerWidth));
    return Math.max(MIN_FILLER_COLUMNS, visibleViewportColumns + FILLER_COLUMN_BUFFER_COLUMNS);
  }, [gridViewport.width, scaledPixels]);

  const bodyRowHeightPx = useMemo(() => scaledPixels(SHEET_BODY_ROW_HEIGHT_PX), [scaledPixels]);
  const groupRowHeightPx = useMemo(() => scaledPixels(SHEET_GROUP_ROW_HEIGHT_PX), [scaledPixels]);

  const displayColumns = useMemo<SpreadsheetDisplayColumn<TKey>[]>(
    () => [
      ...columns.map(
        (column, actualIndex): SpreadsheetDisplayColumn<TKey> => ({
          kind: 'actual',
          actualIndex,
          column,
          letter: column.letter,
          widthPx: column.widthPx,
        }),
      ),
      ...Array.from({ length: fillerColumnCount }, (_, fillerIndex): SpreadsheetDisplayColumn<TKey> => {
        const actualIndex = columns.length + fillerIndex;
        return {
          kind: 'filler',
          actualIndex,
          key: `filler_col_${fillerIndex}`,
          letter: toExcelColumnLetter(actualIndex),
          widthPx: SHEET_FILLER_COLUMN_WIDTH_PX,
        };
      }),
    ],
    [columns, fillerColumnCount],
  );

  const sheetVars = useMemo(
    () =>
      ({
        '--sheet-scale': String(zoomPercent / 100),
        '--sheet-row-number-width': `${rowNumberWidthPx}px`,
        '--sheet-letter-band-height': `${scaledPixels(SHEET_LETTER_BAND_HEIGHT_PX)}px`,
        '--sheet-header-height': `${scaledPixels(SHEET_HEADER_HEIGHT_PX)}px`,
        '--sheet-row-height': `${bodyRowHeightPx}px`,
        '--sheet-year-row-height': `${groupRowHeightPx}px`,
      }) as CSSProperties,
    [bodyRowHeightPx, groupRowHeightPx, rowNumberWidthPx, scaledPixels, zoomPercent],
  );

  useEffect(() => {
    if(!active)return;
    writeSheetZoomPreference(zoomStorageKey, zoomPercent);
  }, [active,zoomPercent, zoomStorageKey]);

  useEffect(() => {
    if(!active)return;
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
  }, [active]);

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

  const stepZoom = useCallback(
    (direction: -1 | 1) => {
      updateZoomPercent(zoomPercent + direction * SHEET_ZOOM_STEP);
    },
    [updateZoomPercent, zoomPercent],
  );

  const fitVisibleColumns = useCallback(() => {
    if (!gridViewport.width) return;
    const actualColumnsWidthPx = columns.reduce((sum, column) => sum + column.widthPx, 0);
    const next = clampSheetZoomPercent((gridViewport.width / Math.max(1, SHEET_ROW_NUMBER_WIDTH_PX + actualColumnsWidthPx)) * 100);
    revealZoomDock();
    setZoomPercent(next);
  }, [columns, gridViewport.width, revealZoomDock]);

  const handleSheetViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    sheetGestureArmedRef.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const nearBottomRight = rect.right - event.clientX <= 360 && rect.bottom - event.clientY <= 148;
    setZoomDockHoverVisible((prev) => (prev === nearBottomRight ? prev : nearBottomRight));
  }, []);

  useEffect(() => {
    if(!active)return;
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
  }, [active,revealZoomDock]);

  return {gridRef,sheetViewportRef,cellStyle,rowNumberWidthPx,scaledPixels,sheetVars,displayColumns,gridViewport,bodyRowHeightPx,groupRowHeightPx,
    viewportProps:{onPointerEnter:()=>{sheetGestureArmedRef.current=true;},onPointerMove:handleSheetViewportPointerMove,
      onPointerLeave:()=>{sheetGestureArmedRef.current=false;setZoomDockHoverVisible(false);}},
    zoom:{value:zoomPercent,presetValue:String(zoomPercent),presets:SHEET_ZOOM_PRESETS,min:SHEET_ZOOM_MIN,max:SHEET_ZOOM_MAX,
      step:SHEET_ZOOM_STEP,setValue:updateZoomPercent,stepBy:stepZoom,fitVisibleColumns,dockActive:zoomDockVisible||zoomDockHoverVisible}};
}
