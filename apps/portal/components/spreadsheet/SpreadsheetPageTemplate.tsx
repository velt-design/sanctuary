'use client';

import StaffPageHeader from '../layout/StaffPageHeader';

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
import {createPortal} from 'react-dom';
import SpreadsheetSurface from './SpreadsheetSurface';
import {SpreadsheetSurfaceProvider,useSpreadsheetSurface} from './SpreadsheetSurfaceContext';
import type {useSpreadsheetViewport} from './useSpreadsheetViewport';
import { editingSessionKey, focusEditorForTrigger } from './editorFocus';
import { useSpreadsheetRows, type SharedSpreadsheetEditingCell } from './useSpreadsheetShell';
import { useSpreadsheetOptimisticEditing } from './useSpreadsheetOptimisticEditing';
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

function SpreadsheetRuntime<
  TRow,
  TKey extends string,
  TEditableKey extends TKey,
  TEditorValue,
  TOptimisticModel = never,
>({
  adapter,
  embedded = false,
  zoomDockPlacement = 'sheet',
}: {
  adapter: SpreadsheetAdapter<TRow, TKey, TEditableKey, TEditorValue, TOptimisticModel>;
  embedded?: boolean;
  zoomDockPlacement?: 'sheet' | 'viewport';
}) {
  const surface=useSpreadsheetSurface()!;
  const mounted=useRef(true);
  useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const shell = useSpreadsheetRows({
    columns: adapter.columns,
    groups: adapter.groups,
    rowNumberRows: adapter.rowNumberRows,
    zoomStorageKey: adapter.zoomStorageKey,
    defaultActiveKey: adapter.defaultActiveKey,
    getRowId: adapter.getRowId,
    isRowSelectable: adapter.isRowSelectable,
  },surface.viewport as ReturnType<typeof useSpreadsheetViewport<TKey>>);

  const [editing, setEditing] = useState<SharedSpreadsheetEditingCell<TEditableKey, TEditorValue> | null>(null);
  const optimisticEditing = useSpreadsheetOptimisticEditing(adapter);
  const editorRef = useRef<SpreadsheetEditorElement | null>(null);
  const editingValueRef = useRef<TEditorValue | undefined>(undefined);
  const editingCellRef = useRef<HTMLTableCellElement | null>(null);
  const editingTriggerRef = useRef<SpreadsheetActivationTrigger | null>(null);
  const pendingPointerCellRef = useRef<PendingPointerCell<TKey> | null>(null);
  const skipBlurCommitRef = useRef(false);
  const allCellKeys = useMemo(() => adapter.columns.map((column) => column.key), [adapter.columns]);
  const rowsById = useMemo(() => new Map(adapter.allRows.map((row) => [adapter.getRowId(row), row])), [adapter.allRows, adapter.getRowId]);
  const visibleRowIds = useMemo(
    () => new Set(shell.visibleRows.map((row) => adapter.getRowId(row))),
    [adapter.getRowId, shell.visibleRows],
  );
  const activeEditingSessionKey = editingSessionKey(editing);
  const savingCells = optimisticEditing?.savingCells ?? adapter.savingCells ?? {};
  const conflictCells = optimisticEditing?.conflictCells ?? adapter.conflictCells ?? {};
  const commitCellEdit = optimisticEditing?.commitEdit ?? adapter.commitEdit;

  useEffect(() => {
    if (editing && visibleRowIds.has(editing.rowId)) return;
    if (!editing && shell.visibleRows.length) return;
    pendingPointerCellRef.current = null;
    editingTriggerRef.current = null;
    editingValueRef.current = undefined;
    editingCellRef.current = null;
    setEditing(null);
  }, [editing, shell.visibleRows.length, visibleRowIds]);

  useLayoutEffect(() => {
    if (!activeEditingSessionKey) return;
    const node = editorRef.current;
    if (!node) return;
    focusEditorForTrigger(node, editingTriggerRef.current);
    maybeOpenPicker(node, editingTriggerRef.current);
  }, [activeEditingSessionKey]);

  const beginEdit = useCallback(
    (row: TRow, key: TEditableKey, trigger: SpreadsheetActivationTrigger, seeded?: TEditorValue) => {
      if(!mounted.current)return;
      const rowId = adapter.getRowId(row);
      const initialValue = seeded !== undefined ? seeded : adapter.getEditorValue(row, key);
      editingTriggerRef.current = trigger;
      editingValueRef.current = initialValue;
      setEditing({
        rowId,
        key,
        value: initialValue,
      });
      shell.setActiveCell({ rowId, key });
    },
    [adapter, shell],
  );

  const cancelEditing = useCallback(() => {
    skipBlurCommitRef.current = true;
    editingTriggerRef.current = null;
    editingValueRef.current = undefined;
    setEditing(null);
  }, []);

  const commitEditing = useCallback(
    async (nextSelection?: SpreadsheetActiveCell<TKey> | null): Promise<boolean> => {
      if(!mounted.current)return false;
      if (!editing) return true;
      const row = rowsById.get(editing.rowId);
      if (!row) {
        editingTriggerRef.current = null;
        editingValueRef.current = undefined;
        setEditing(null);
        return false;
      }

      if (!commitCellEdit) return false;
      const nextValue = editingValueRef.current !== undefined ? editingValueRef.current : editing.value;
      const ok = await commitCellEdit(row, editing.key, nextValue);
      if(!mounted.current)return false;
      if (ok) {
        editingTriggerRef.current = null;
        editingValueRef.current = undefined;
        setEditing(null);
        if (nextSelection) shell.setActiveCell(nextSelection);
      }
      return ok;
    },
    [commitCellEdit, editing, rowsById, shell],
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
        commitValue: async (committedValue) => {
          if (!mounted.current || !adapter.isEditableKey(key) || !commitCellEdit) return false;
          return commitCellEdit(row, key, committedValue);
        },
      });
    },
    [adapter, beginEdit, commitCellEdit],
  );

  const keepEditingWithinCell = useCallback(() => {
    pendingPointerCellRef.current = null;
    window.requestAnimationFrame(() => {
      if(mounted.current)editorRef.current?.focus();
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
      const currentEditingRow = currentEditing ? rowsById.get(currentEditing.rowId) ?? null : null;
      const currentEditingValue =
        currentEditing && editingValueRef.current !== undefined ? editingValueRef.current : currentEditing?.value;
      const isUnchangedEdit = Boolean(
        currentEditing &&
          currentEditingRow &&
          Object.is(adapter.getEditorValue(currentEditingRow, currentEditing.key), currentEditingValue),
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
      if (isUnchangedEdit) {
        editingTriggerRef.current = null;
        editingValueRef.current = undefined;
        setEditing(null);
        if (nextSelection) {
          shell.setActiveCell(nextSelection);
          shell.focusGrid();
        }
        return;
      }

      const ok = await commitEditing(nextSelection);
      if(!mounted.current)return;
      if (!ok) {
        window.requestAnimationFrame(() => {
          editorRef.current?.focus();
        });
        return;
      }

      if (nextSelection) {
        shell.setActiveCell(nextSelection);
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

  useLayoutEffect(()=>{surface.publish({toolbar:adapter.toolbar,onKeyDown:handleGridKeyDown});});
  useLayoutEffect(()=>()=>surface.publish(null),[surface.publish]);
  return surface.body?createPortal(<>
                    {!shell.visibleRows.length && <tr><td colSpan={shell.displayColumns.length+1} className={styles.emptyTable} role={adapter.loading?'status':adapter.hasError?'alert':undefined}>{adapter.loading?adapter.loadingMessage:adapter.hasError?adapter.errorMessage:adapter.emptyMessage}</td></tr>}
                    {(shell.visibleRows.length?shell.displayRows:[]).map((displayRow) => {
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
                                  saving: Boolean(savingCells[cellKey]),
                                  conflict: Boolean(conflictCells[cellKey]),
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
                                      setValue: (value) => {
                                        editingValueRef.current = value;
                                        setEditing((prev) => (prev ? { ...prev, value } : prev));
                                      },
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
</>,surface.body):null;
}

export default function SpreadsheetPageTemplate<TRow,TKey extends string,TEditableKey extends TKey,TEditorValue,TOptimisticModel=never>(props:{
  adapter:SpreadsheetAdapter<TRow,TKey,TEditableKey,TEditorValue,TOptimisticModel>;embedded?:boolean;zoomDockPlacement?:'sheet'|'viewport';
}){
  const existing=useSpreadsheetSurface();const owner=useRef({});
  const {adapter}=props;
  if(existing)return <SpreadsheetRuntime {...props}/>;
  return <SpreadsheetSurfaceProvider owner={owner.current} config={{title:adapter.title,columns:adapter.columns,zoomStorageKey:adapter.zoomStorageKey}}>
    <SpreadsheetSurface header={<StaffPageHeader title={adapter.title}/>} toolbar={adapter.toolbar} loading={adapter.loading} hasError={adapter.hasError} loadingMessage={adapter.loadingMessage}
      errorMessage={adapter.errorMessage} emptyMessage={adapter.emptyMessage} embedded={props.embedded} zoomDockPlacement={props.zoomDockPlacement}/>
    <SpreadsheetRuntime {...props}/>
  </SpreadsheetSurfaceProvider>;
}
