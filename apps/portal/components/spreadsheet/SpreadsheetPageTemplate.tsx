'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import PageHeader from '../layout/PageHeader';
import { editingSessionKey, focusEditorForTrigger } from './editorFocus';
import { useSpreadsheetShell, type SharedSpreadsheetEditingCell } from './useSpreadsheetShell';
import type {
  SpreadsheetActiveCell,
  SpreadsheetActivationTrigger,
  SpreadsheetAdapter,
  SpreadsheetEditorElement,
} from './types';
import styles from './spreadsheet.module.css';

type PendingPointerCell<TKey extends string> = {
  rowId: string;
  key: TKey;
};

function isPrintableKey(event: ReactKeyboardEvent): boolean {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function maybeOpenPicker(node: SpreadsheetEditorElement | null, trigger: SpreadsheetActivationTrigger | null): void {
  if (!node || trigger !== 'click') return;

  const supportsPicker =
    node instanceof HTMLSelectElement || (node instanceof HTMLInputElement && node.type === 'date');
  if (!supportsPicker) return;

  const pickerNode = node as SpreadsheetEditorElement & { showPicker?: () => void };
  if (typeof pickerNode.showPicker !== 'function') return;

  try {
    pickerNode.showPicker();
  } catch {
    // Ignore picker APIs blocked by browser gesture rules.
  }
}

export default function SpreadsheetPageTemplate<TRow, TKey extends string, TEditableKey extends TKey, TEditorValue>({
  adapter,
  embedded = false,
  zoomDockPlacement = 'sheet',
}: {
  adapter: SpreadsheetAdapter<TRow, TKey, TEditableKey, TEditorValue>;
  embedded?: boolean;
  zoomDockPlacement?: 'sheet' | 'viewport';
}) {
  const shell = useSpreadsheetShell({
    columns: adapter.columns,
    groups: adapter.groups,
    rowNumberRows: adapter.rowNumberRows,
    zoomStorageKey: adapter.zoomStorageKey,
    defaultActiveKey: adapter.defaultActiveKey,
    getRowId: adapter.getRowId,
    isRowSelectable: adapter.isRowSelectable,
  });

  const [editing, setEditing] = useState<SharedSpreadsheetEditingCell<TEditableKey, TEditorValue> | null>(null);
  const editorRef = useRef<SpreadsheetEditorElement | null>(null);
  const editingCellRef = useRef<HTMLTableCellElement | null>(null);
  const editingTriggerRef = useRef<SpreadsheetActivationTrigger | null>(null);
  const pendingPointerCellRef = useRef<PendingPointerCell<TKey> | null>(null);
  const skipBlurCommitRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [viewportZoomDockVisible, setViewportZoomDockVisible] = useState(zoomDockPlacement !== 'viewport');

  const allCellKeys = useMemo(() => adapter.columns.map((column) => column.key), [adapter.columns]);
  const rowsById = useMemo(() => new Map(adapter.allRows.map((row) => [adapter.getRowId(row), row])), [adapter.allRows, adapter.getRowId]);
  const activeEditingSessionKey = editingSessionKey(editing);
  const useViewportZoomDock = zoomDockPlacement === 'viewport';

  useEffect(() => {
    if (!shell.visibleRows.length) {
      pendingPointerCellRef.current = null;
      editingTriggerRef.current = null;
      setEditing(null);
    }
  }, [shell.visibleRows.length]);

  useEffect(() => {
    if (!useViewportZoomDock) {
      setViewportZoomDockVisible(true);
      return;
    }

    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setViewportZoomDockVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setViewportZoomDockVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: [0, 0.05, 0.1] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [useViewportZoomDock]);

  useLayoutEffect(() => {
    if (!activeEditingSessionKey) return;
    const node = editorRef.current;
    if (!node) return;
    focusEditorForTrigger(node, editingTriggerRef.current);
    maybeOpenPicker(node, editingTriggerRef.current);
  }, [activeEditingSessionKey]);

  const beginEdit = useCallback(
    (row: TRow, key: TEditableKey, trigger: SpreadsheetActivationTrigger, seeded?: TEditorValue) => {
      const rowId = adapter.getRowId(row);
      editingTriggerRef.current = trigger;
      setEditing({
        rowId,
        key,
        value: seeded !== undefined ? seeded : adapter.getEditorValue(row, key),
      });
      shell.setActiveCell({ rowId, key });
    },
    [adapter, shell],
  );

  const cancelEditing = useCallback(() => {
    skipBlurCommitRef.current = true;
    editingTriggerRef.current = null;
    setEditing(null);
  }, []);

  const commitEditing = useCallback(
    async (nextSelection?: SpreadsheetActiveCell<TKey> | null): Promise<boolean> => {
      if (!editing) return true;
      const row = rowsById.get(editing.rowId);
      if (!row) {
        editingTriggerRef.current = null;
        setEditing(null);
        return false;
      }

      const ok = await adapter.commitEdit(row, editing.key, editing.value);
      if (ok) {
        editingTriggerRef.current = null;
        setEditing(null);
        if (nextSelection) shell.setActiveCell(nextSelection);
      }
      return ok;
    },
    [adapter, editing, rowsById, shell],
  );

  const moveActiveCell = useCallback(
    (rowDelta: number, columnDelta: number) => {
      if (!shell.activeCell || !shell.selectableRows.length) return;
      const rowIndex = shell.selectableRows.findIndex((row) => adapter.getRowId(row) === shell.activeCell?.rowId);
      const columnIndex = allCellKeys.indexOf(shell.activeCell.key);
      const nextRow = shell.selectableRows[Math.max(0, Math.min(shell.selectableRows.length - 1, rowIndex + rowDelta))];
      const nextColumn = allCellKeys[Math.max(0, Math.min(allCellKeys.length - 1, columnIndex + columnDelta))] ?? shell.activeCell.key;
      shell.setActiveCell({ rowId: adapter.getRowId(nextRow), key: nextColumn });
    },
    [adapter, allCellKeys, shell],
  );

  const handleCellActivation = useCallback(
    async (trigger: SpreadsheetActivationTrigger, row: TRow, key: TKey, seed?: string) => {
      return adapter.onCellActivated({
        trigger,
        row,
        key,
        seed,
        beginEdit: (seeded) => {
          if (!adapter.isEditableKey(key)) return;
          beginEdit(row, key, trigger, seeded);
        },
      });
    },
    [adapter, beginEdit],
  );

  const keepEditingWithinCell = useCallback(() => {
    pendingPointerCellRef.current = null;
    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }, []);

  const handleEditorBlur = useCallback(
    async (event: ReactFocusEvent<SpreadsheetEditorElement>) => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false;
        pendingPointerCellRef.current = null;
        return;
      }

      const currentEditing = editing;
      const pendingPointerCell = pendingPointerCellRef.current;
      const nextFocusedNode = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      const blurStayedInsideEditingCell = Boolean(
        editingCellRef.current && nextFocusedNode && editingCellRef.current.contains(nextFocusedNode),
      );
      const pointerStayedInsideEditingCell = Boolean(
        currentEditing &&
          pendingPointerCell &&
          pendingPointerCell.rowId === currentEditing.rowId &&
          pendingPointerCell.key === currentEditing.key,
      );

      if (blurStayedInsideEditingCell || pointerStayedInsideEditingCell) {
        keepEditingWithinCell();
        return;
      }

      const nextSelection = pendingPointerCell
        ? ({
            rowId: pendingPointerCell.rowId,
            key: pendingPointerCell.key,
          } satisfies SpreadsheetActiveCell<TKey>)
        : undefined;

      pendingPointerCellRef.current = null;
      const ok = await commitEditing(nextSelection);
      if (!ok) {
        window.requestAnimationFrame(() => {
          editorRef.current?.focus();
        });
        return;
      }

      if (!pendingPointerCell) return;
      const targetRow = rowsById.get(pendingPointerCell.rowId);
      if (!targetRow) {
        shell.focusGrid();
        return;
      }

      const result = await handleCellActivation('click', targetRow, pendingPointerCell.key);
      if (result === 'noop') {
        shell.focusGrid();
      }
    },
    [commitEditing, editing, handleCellActivation, keepEditingWithinCell, rowsById, shell],
  );

  const handleGridKeyDown = useCallback(
    async (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!shell.activeCell || editing) return;

      const row = rowsById.get(shell.activeCell.rowId);
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
        await handleCellActivation('enter', row, shell.activeCell.key);
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        await handleCellActivation('space', row, shell.activeCell.key);
        return;
      }
      if (isPrintableKey(event)) {
        const result = await handleCellActivation('printable', row, shell.activeCell.key, event.key);
        if (result === 'handled') event.preventDefault();
      }
    },
    [editing, handleCellActivation, moveActiveCell, rowsById, shell],
  );

  return (
    <main className={`${styles.page} ${embedded ? styles.pageEmbedded : ''}`}>
      {embedded ? null : <PageHeader title={adapter.title} />}

      <div className={styles.stack}>
        <section ref={sectionRef} className={styles.section}>
          {adapter.toolbar}

          {adapter.loading && !adapter.allRows.length ? (
            <div className={styles.emptyState}>{adapter.loadingMessage}</div>
          ) : adapter.hasError && !adapter.allRows.length ? (
            <div className={styles.emptyState}>{adapter.errorMessage}</div>
          ) : !shell.visibleRows.length ? (
            <div className={styles.emptyTable}>{adapter.emptyMessage}</div>
          ) : (
            <div ref={shell.sheetViewportRef} className={styles.sheetViewport} {...shell.viewportProps}>
              <div ref={shell.gridRef} className={styles.tableScroller} style={shell.sheetVars} tabIndex={0} onKeyDown={handleGridKeyDown}>
                <table className={styles.table}>
                  <colgroup>
                    <col style={{ width: shell.rowNumberWidthPx }} />
                    {shell.displayColumns.map((column) => (
                      <col key={column.kind === 'actual' ? column.column.key : column.key} style={{ width: shell.scaledPixels(column.widthPx) }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className={styles.letterRow}>
                      <th className={`${styles.cornerCell} ${styles.rowNumberBandCell}`} />
                      {shell.displayColumns.map((column) => (
                        <th
                          key={column.kind === 'actual' ? `${column.column.key}_letter` : `${column.key}_letter`}
                          className={`${styles.letterCell} ${column.kind === 'actual' && column.column.frozen ? styles.frozenLetterCell : ''}`}
                          style={column.kind === 'actual' ? shell.cellStyle(column.column, column.actualIndex) : undefined}
                          scope="col"
                        >
                          {column.letter}
                        </th>
                      ))}
                    </tr>
                    <tr className={styles.labelsRow}>
                      <th className={`${styles.rowNumberHeaderCell} ${styles.rowNumberBandCell}`} />
                      {shell.displayColumns.map((column) => (
                        <th
                          key={column.kind === 'actual' ? `${column.column.key}_header` : `${column.key}_header`}
                          className={
                            column.kind === 'actual'
                              ? `${styles.headerCell} ${column.column.frozen ? styles.frozenHeaderCell : ''}`
                              : styles.fillerHeaderCell
                          }
                          style={column.kind === 'actual' ? shell.cellStyle(column.column, column.actualIndex) : undefined}
                          scope="col"
                        >
                          {column.kind === 'actual' ? (
                            <>
                              <span className={styles.headerLabel}>{column.column.label}</span>
                              {column.column.sourceLabel ? <span className={styles.headerSource}>{column.column.sourceLabel}</span> : null}
                            </>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shell.displayRows.map((displayRow) => {
                      if (displayRow.kind === 'group') {
                        return (
                          <tr key={displayRow.key} className={styles.yearDividerRow}>
                            <th className={`${styles.rowNumberCell} ${styles.rowNumberBlankCell}`} />
                            <th className={styles.yearRow} colSpan={shell.displayColumns.length} scope="rowgroup">
                              {displayRow.label}
                            </th>
                          </tr>
                        );
                      }

                      if (displayRow.kind === 'filler') {
                        return (
                          <tr key={displayRow.key} className={styles.fillerRow}>
                            <th className={`${styles.rowNumberCell} ${styles.rowNumberBlankCell}`} />
                            {shell.displayColumns.map((column) => (
                              <td
                                key={column.kind === 'actual' ? `${displayRow.key}_${column.column.key}` : `${displayRow.key}_${column.key}`}
                                className={`${styles.bodyCell} ${styles.fillerCell} ${
                                  column.kind === 'actual' && column.column.frozen ? styles.frozenFillerCell : ''
                                }`}
                                style={column.kind === 'actual' ? shell.cellStyle(column.column, column.actualIndex) : undefined}
                              />
                            ))}
                          </tr>
                        );
                      }

                      const row = displayRow.row;
                      const rowId = adapter.getRowId(row);
                      const rowSelectable = adapter.isRowSelectable ? adapter.isRowSelectable(row) : true;

                      return (
                        <tr key={displayRow.key} className={adapter.getRowClassName(row)}>
                          <th className={styles.rowNumberCell} scope="row">
                            {displayRow.rowNumber}
                          </th>
                          {shell.displayColumns.map((displayColumn) => {
                            if (displayColumn.kind === 'filler') {
                              return <td key={`${rowId}_${displayColumn.key}`} className={`${styles.bodyCell} ${styles.fillerCell}`} />;
                            }

                            const column = displayColumn.column;
                            const cellKey = `${rowId}:${column.key}`;
                            const isActive = shell.activeCell?.rowId === rowId && shell.activeCell?.key === column.key;
                            const isEditing = editing?.rowId === rowId && editing?.key === column.key;
                            const text = adapter.formatCellValue(row, column.key);

                            return (
                              <td
                                key={column.key}
                                ref={(node) => {
                                  shell.setCellRef(cellKey, node);
                                  if (isEditing) {
                                    editingCellRef.current = node;
                                  } else if (editingCellRef.current?.dataset.cellId === cellKey) {
                                    editingCellRef.current = null;
                                  }
                                }}
                                data-cell-id={cellKey}
                                className={adapter.getCellClassName({
                                  row,
                                  column,
                                  active: Boolean(isActive),
                                  editing: Boolean(isEditing),
                                  saving: Boolean(adapter.savingCells[cellKey]),
                                  conflict: Boolean(adapter.conflictCells[cellKey]),
                                })}
                                style={shell.cellStyle(column, displayColumn.actualIndex)}
                                onPointerDownCapture={() => {
                                  if (!rowSelectable || !editing) return;
                                  pendingPointerCellRef.current = { rowId, key: column.key };
                                }}
                                onClick={() => {
                                  if (!rowSelectable) return;
                                  const clickedEditingCell = Boolean(editing?.rowId === rowId && editing?.key === column.key);
                                  if (clickedEditingCell) {
                                    keepEditingWithinCell();
                                    return;
                                  }
                                  if (editing) return;
                                  shell.setActiveCell({ rowId, key: column.key });
                                  shell.focusGrid();
                                  void handleCellActivation('click', row, column.key);
                                }}
                                onDoubleClick={async () => {
                                  if (!rowSelectable) return;
                                  await handleCellActivation('double_click', row, column.key);
                                }}
                              >
                                {isEditing && adapter.isEditableKey(column.key)
                                  ? adapter.renderEditor({
                                      row,
                                      key: column.key,
                                      value: editing.value,
                                      setValue: (value) => setEditing((prev) => (prev ? { ...prev, value } : prev)),
                                      commit: () => commitEditing(),
                                      cancel: cancelEditing,
                                      commitToNeighbor: async (columnDelta) => {
                                        const rowIndex = shell.selectableRows.findIndex((item) => adapter.getRowId(item) === rowId);
                                        if (rowIndex === -1) return commitEditing();
                                        const columnIndex = allCellKeys.indexOf(column.key);
                                        const nextRow = shell.selectableRows[Math.max(0, rowIndex)];
                                        const nextColumn =
                                          allCellKeys[Math.max(0, Math.min(allCellKeys.length - 1, columnIndex + columnDelta))] ?? column.key;
                                        return commitEditing({ rowId: adapter.getRowId(nextRow), key: nextColumn });
                                      },
                                      editorRef: (node) => {
                                        editorRef.current = node;
                                      },
                                      onBlur: handleEditorBlur,
                                    })
                                  : adapter.renderCellContent({ row, column, text })}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div
                className={`${styles.zoomDockLayer} ${useViewportZoomDock ? styles.zoomDockLayerViewport : ''}`}
                data-active={shell.zoom.dockActive ? 'true' : 'false'}
                data-visible={viewportZoomDockVisible ? 'true' : 'false'}
              >
                <div className={`${styles.zoomDock} ${useViewportZoomDock ? styles.zoomDockViewport : ''}`} aria-label="Sheet zoom controls">
                  <button type="button" className={styles.zoomButton} onClick={() => shell.zoom.stepBy(-1)} aria-label="Zoom out">
                    -
                  </button>
                  <input
                    className={styles.zoomSlider}
                    type="range"
                    min={shell.zoom.min}
                    max={shell.zoom.max}
                    step={shell.zoom.step}
                    value={shell.zoom.value}
                    onChange={(event) => shell.zoom.setValue(Number.parseInt(event.target.value, 10))}
                    aria-label="Sheet zoom"
                  />
                  <button type="button" className={styles.zoomButton} onClick={() => shell.zoom.stepBy(1)} aria-label="Zoom in">
                    +
                  </button>
                  <select
                    className={styles.zoomPreset}
                    value={shell.zoom.presetValue}
                    onChange={(event) => shell.zoom.setValue(Number.parseInt(event.target.value, 10))}
                    aria-label="Zoom preset"
                  >
                    {shell.zoom.presets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}%
                      </option>
                    ))}
                    {!shell.zoom.presets.includes(shell.zoom.value as (typeof shell.zoom.presets)[number]) ? (
                      <option value={shell.zoom.value}>{shell.zoom.value}%</option>
                    ) : null}
                  </select>
                  <button type="button" className={styles.fitButton} onClick={shell.zoom.fitVisibleColumns}>
                    Fit visible columns
                  </button>
                  <span className={styles.zoomValue}>{shell.zoom.value}%</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
