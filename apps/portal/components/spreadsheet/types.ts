import type { FocusEvent as ReactFocusEvent, ReactNode } from 'react';

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
  showHeader?: boolean;
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
export type SpreadsheetEditorElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export type SpreadsheetOptimisticEditOutcome<TConfirmedModel> =
  | {
      kind: 'success';
      confirmedModel: TConfirmedModel;
      message?: string;
      conflict?: boolean;
    }
  | {
      kind: 'drop';
      confirmedModel?: TConfirmedModel;
      message?: string;
      conflict?: boolean;
    };

export type SpreadsheetPreparedOptimisticEdit<TConfirmedModel> = {
  applyToModel: (confirmedModel: TConfirmedModel) => TConfirmedModel;
  persist: (confirmedModel: TConfirmedModel) => Promise<SpreadsheetOptimisticEditOutcome<TConfirmedModel>>;
};

type SpreadsheetOptimisticEditingController<
  TRow,
  TEditableKey extends string,
  TEditorValue,
  TConfirmedModel,
> = {
  getQueueKey?: (rowId: string, row: TRow) => string;
  getLatestConfirmedModel: (args: { rowId: string; row: TRow }) => TConfirmedModel | null;
  displayModel: (queueKey: string, model: TConfirmedModel) => void;
  prepareEdit: (args: {
    row: TRow;
    rowId: string;
    cellId: string;
    key: TEditableKey;
    value: TEditorValue;
    confirmedModel: TConfirmedModel;
    displayedModel: TConfirmedModel;
  }) =>
    | { kind: 'enqueue'; edit: SpreadsheetPreparedOptimisticEdit<TConfirmedModel> }
    | { kind: 'noop' }
    | { kind: 'error'; message: string };
  onEditOutcome?: (args: {
    rowId: string;
    cellId: string;
    key: TEditableKey;
    queueKey: string;
    outcome: SpreadsheetOptimisticEditOutcome<TConfirmedModel>;
    confirmedModel: TConfirmedModel;
  }) => void | Promise<void>;
  conflictDurationMs?: number;
};

export type SpreadsheetAdapter<
  TRow,
  TKey extends string,
  TEditableKey extends TKey,
  TEditorValue,
  TOptimisticModel = never,
> = {
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
  savingCells?: Record<string, boolean>;
  conflictCells?: Record<string, boolean>;
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
    editorRef: (node: SpreadsheetEditorElement | null) => void;
    onBlur: (event: ReactFocusEvent<SpreadsheetEditorElement>) => Promise<void>;
  }) => ReactNode;
  commitEdit?: (row: TRow, key: TEditableKey, value: TEditorValue) => Promise<boolean>;
  optimisticEditing?: SpreadsheetOptimisticEditingController<TRow, TEditableKey, TEditorValue, TOptimisticModel>;
  onCellActivated: (args: {
    trigger: SpreadsheetActivationTrigger;
    row: TRow;
    key: TKey;
    seed?: string;
    beginEdit: (seeded?: TEditorValue) => void;
    commitValue: (value: TEditorValue) => Promise<boolean>;
  }) => Promise<'handled' | 'noop'> | 'handled' | 'noop';
};
