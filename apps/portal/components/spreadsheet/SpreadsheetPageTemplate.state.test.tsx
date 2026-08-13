import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import type { SpreadsheetAdapter } from './types';
import SpreadsheetPageTemplate from './SpreadsheetPageTemplate';

type Row = { id: string; value: string };
type Key = 'value';

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({ error: vi.fn() }),
}));

function adapter(rows: Row[]): SpreadsheetAdapter<Row, Key, Key, string> {
  return {
    title: 'Test sheet',
    toolbar: null,
    columns: [{ key: 'value', letter: 'A', label: 'Value', widthPx: 180, editable: true }],
    allRows: rows,
    rowNumberRows: rows,
    groups: [{ key: 'all', label: 'All', showHeader: false, rows }],
    zoomStorageKey: 'test-sheet-zoom',
    defaultActiveKey: 'value',
    loading: false,
    hasError: false,
    loadingMessage: 'Loading',
    errorMessage: 'Error',
    emptyMessage: 'Empty',
    getRowId: (row) => row.id,
    isEditableKey: (key): key is Key => key === 'value',
    getRowClassName: () => '',
    getCellClassName: () => '',
    formatCellValue: (row) => row.value,
    renderCellContent: ({ text }) => text,
    getEditorValue: (row) => row.value,
    renderEditor: ({ value, setValue, editorRef, onBlur }) => (
      <input
        ref={editorRef}
        aria-label="Cell editor"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={onBlur}
      />
    ),
    commitEdit: async () => true,
    onCellActivated: ({ beginEdit }) => {
      beginEdit();
      return 'handled';
    },
  };
}

describe('SpreadsheetPageTemplate state reconciliation', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage.removeItem('test-sheet-zoom');
  });

  it('closes an editor when filtering or refresh removes its row', () => {
    const row = { id: 'row_1', value: 'Original' };
    const rendered = renderIntoDocument(<SpreadsheetPageTemplate adapter={adapter([row])} />);
    const cell = rendered.container.querySelector('[data-cell-id="row_1:value"]');

    act(() => cell?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(rendered.container.querySelector('[aria-label="Cell editor"]')).not.toBeNull();

    rendered.rerender(<SpreadsheetPageTemplate adapter={adapter([])} />);
    expect(rendered.container.querySelector('[aria-label="Cell editor"]')).toBeNull();
    rendered.unmount();
  });
});
