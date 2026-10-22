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

  it('preserves real columns and zoom across pending, error, success and empty reads without filler records',()=>{
    const base=adapter([]),pending={...base,loading:true};
    const view=renderIntoDocument(<SpreadsheetPageTemplate adapter={pending}/>);
    const table=view.container.querySelector('table'),header=view.container.querySelector('thead'),zoom=view.container.querySelector('[aria-label="Sheet zoom"]');
    expect(header?.textContent).toContain('Value');expect(table?.textContent).toContain('Loading');expect(view.container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(view.container.querySelector('[data-cell-id]')).toBeNull();
    act(()=>{const select=view.container.querySelector<HTMLSelectElement>('[aria-label="Zoom preset"]')!;select.value='125';select.dispatchEvent(new Event('change',{bubbles:true}));});
    view.rerender(<SpreadsheetPageTemplate adapter={{...base,hasError:true}}/>);
    expect(table?.textContent).toContain('Error');expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('thead')).toBe(header);
    view.rerender(<SpreadsheetPageTemplate adapter={adapter([{id:'real',value:'Confirmed'}])}/>);
    expect(table?.textContent).toContain('Confirmed');expect(view.container.querySelector('[aria-label="Sheet zoom"]')).toBe(zoom);
    expect(view.container.querySelector<HTMLSelectElement>('[aria-label="Zoom preset"]')?.value).toBe('125');
    view.rerender(<SpreadsheetPageTemplate adapter={base}/>);expect(table?.textContent).toContain('Empty');expect(view.container.querySelectorAll('tbody tr')).toHaveLength(1);view.unmount();
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
