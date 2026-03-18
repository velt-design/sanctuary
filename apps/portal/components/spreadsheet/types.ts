import type { ReactNode } from 'react';

export type SpreadsheetColumn<TKey extends string> = {
  key: TKey;
  letter: string;
  label: string;
  widthPx: number;
  editable: boolean;
  frozen?: boolean;
  sourceLabel?: string | null;
};

export type SpreadsheetGroup<TRow> = {
  key: string;
  label: string;
  rows: TRow[];
};

export type SpreadsheetDisplayColumn<TKey extends string> =
  | {
      kind: 'actual';
      actualIndex: number;
      column: SpreadsheetColumn<TKey>;
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

export type SpreadsheetDisplayRow<TRow> =
  | { kind: 'group'; key: string; label: string }
  | { kind: 'row'; key: string; row: TRow; rowNumber: number }
  | { kind: 'filler'; key: string };

export type SpreadsheetActiveCell<TKey extends string> = {
  rowId: string;
  key: TKey;
};

export type SpreadsheetEditingCell<TKey extends string, TValue> = {
  rowId: string;
  key: TKey;
  value: TValue;
};

export type SpreadsheetActivationTrigger = 'click' | 'enter' | 'space' | 'double_click' | 'printable';

export type SpreadsheetAdapter<TRow, TKey extends string, TEditableKey extends TKey, TEditorValue> = {
  title: string;
  toolbar: ReactNode;
  columns: readonly SpreadsheetColumn<TKey>[];
  allRows: readonly TRow[];
  rowNumberRows: readonly TRow[];
  groups: readonly SpreadsheetGroup<TRow>[];
  zoomStorageKey: string;
  defaultActiveKey: TKey;
  loading: boolean;
  hasError: boolean;
  loadingMessage: string;
  errorMessage: string;
  emptyMessage: string;
  savingCells: Record<string, boolean>;
  conflictCells: Record<string, boolean>;
  getRowId: (row: TRow) => string;
  isRowSelectable?: (row: TRow) => boolean;
  isEditableKey: (key: TKey) => key is TEditableKey;
  getRowClassName: (row: TRow) => string;
  getCellClassName: (args: {
    row: TRow;
    column: SpreadsheetColumn<TKey>;
    active: boolean;
    editing: boolean;
    saving: boolean;
    conflict: boolean;
  }) => string;
  formatCellValue: (row: TRow, key: TKey) => string;
  renderCellContent: (args: { row: TRow; column: SpreadsheetColumn<TKey>; text: string }) => ReactNode;
  getEditorValue: (row: TRow, key: TEditableKey) => TEditorValue;
  renderEditor: (args: {
    row: TRow;
    key: TEditableKey;
    value: TEditorValue;
    setValue: (value: TEditorValue) => void;
    commit: () => Promise<boolean>;
    cancel: () => void;
    commitToNeighbor: (columnDelta: number) => Promise<boolean>;
    editorRef: (node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => void;
    onBlur: () => Promise<void>;
  }) => ReactNode;
  commitEdit: (row: TRow, key: TEditableKey, value: TEditorValue) => Promise<boolean>;
  onCellActivated: (args: {
    trigger: SpreadsheetActivationTrigger;
    row: TRow;
    key: TKey;
    seed?: string;
    beginEdit: (seeded?: TEditorValue) => void;
  }) => Promise<'handled' | 'noop'> | 'handled' | 'noop';
};
