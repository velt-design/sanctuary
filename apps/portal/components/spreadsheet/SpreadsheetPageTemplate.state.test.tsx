import {SpreadsheetWorkspace} from './SpreadsheetWorkspace';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import type { SpreadsheetAdapter } from './types';
import SpreadsheetPageTemplate from './SpreadsheetPageTemplate';
import SpreadsheetSurface from './SpreadsheetSurface';
import {SpreadsheetSurfaceProvider} from './SpreadsheetSurfaceContext';

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

it('uses the same public spreadsheet viewport for guarded real cells, editing, keyboard selection and zoom',async()=>{
 const base=adapter([{id:'row_1',value:'Original'},{id:'row_2',value:'Next'}]);
 const owner={};const config={title:base.title,columns:base.columns,zoomStorageKey:base.zoomStorageKey};
 const commit=vi.fn(async()=>true);const guarded={...base,commitEdit:commit};
 const ui=(ready:boolean)=><SpreadsheetSurfaceProvider owner={ready?owner:null} config={config}>
   <SpreadsheetSurface toolbar={null} loading loadingMessage="Reading verified rows" errorMessage="Unavailable" emptyMessage="Empty"/>
   {ready?<SpreadsheetPageTemplate adapter={guarded}/>:null}
 </SpreadsheetSurfaceProvider>;
 const view=renderIntoDocument(ui(false));const table=view.container.querySelector('table'),head=view.container.querySelector('thead'),zoom=view.container.querySelector('[aria-label="Sheet zoom"]');
 const grid=view.container.querySelector<HTMLDivElement>('[tabindex="0"]')!;grid.scrollTop=120;
 act(()=>{const preset=view.container.querySelector<HTMLSelectElement>('[aria-label="Zoom preset"]')!;preset.value='125';preset.dispatchEvent(new Event('change',{bubbles:true}));});
 if(!Element.prototype.scrollIntoView)Element.prototype.scrollIntoView=()=>{};
 const scroll=vi.spyOn(Element.prototype,'scrollIntoView').mockImplementation(()=>{});
 scroll.mockClear();
 view.rerender(ui(true));
 expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('thead')).toBe(head);expect(view.container.querySelector('[aria-label="Sheet zoom"]')).toBe(zoom);
 expect(view.container.querySelector<HTMLSelectElement>('[aria-label="Zoom preset"]')?.value).toBe('125');expect(grid.scrollTop).toBe(120);expect(scroll).not.toHaveBeenCalled();
 act(()=>view.container.querySelector<HTMLTableCellElement>('[data-cell-id="row_1:value"]')!.click());
 expect(view.container.querySelector<HTMLInputElement>('[aria-label="Cell editor"]')?.value).toBe('Original');
 const editor=view.container.querySelector<HTMLInputElement>('[aria-label="Cell editor"]')!;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(editor,'Edited');editor.dispatchEvent(new Event('input',{bubbles:true}));});
 act(()=>editor.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:grid})));await act(async()=>{await Promise.resolve();});
 expect(commit).toHaveBeenCalledTimes(1);
 expect(commit).toHaveBeenCalledWith(base.allRows[0],'value','Edited');
 act(()=>grid.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
 expect(scroll).toHaveBeenCalled();
 view.rerender(ui(false));expect(view.container.querySelector('[data-cell-id]')).toBeNull();expect(view.container.querySelector('[aria-label="Cell editor"]')).toBeNull();expect(view.container.querySelector('table')).toBe(table);
 view.unmount();scroll.mockRestore();
});

it('does not focus a new public viewport when an older guarded editor finishes saving',async()=>{
 if(!Element.prototype.scrollIntoView)Element.prototype.scrollIntoView=()=>{};
 let complete!:(saved:boolean)=>void;const pending=new Promise<boolean>(resolve=>{complete=resolve;});
 const base={...adapter([{id:'a',value:'Original'},{id:'b',value:'Next'}]),commitEdit:vi.fn(()=>pending)};
 const owner={},config={title:base.title,columns:base.columns,zoomStorageKey:base.zoomStorageKey};
 const ui=(ready:boolean)=><SpreadsheetSurfaceProvider owner={ready?owner:null} config={config}>
   <SpreadsheetSurface toolbar={<input aria-label="Public filter"/>} loading loadingMessage="Reading" errorMessage="Unavailable" emptyMessage="Empty"/>
   {ready?<SpreadsheetPageTemplate adapter={base}/>:null}
 </SpreadsheetSurfaceProvider>;
 const view=renderIntoDocument(ui(true));const grid=view.container.querySelector<HTMLDivElement>('[tabindex="0"]')!;
 act(()=>view.container.querySelector<HTMLTableCellElement>('[data-cell-id="a:value"]')!.click());
 const editor=view.container.querySelector<HTMLInputElement>('[aria-label="Cell editor"]')!;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(editor,'Edited');editor.dispatchEvent(new Event('input',{bubbles:true}));});
 const next=view.container.querySelector<HTMLTableCellElement>('[data-cell-id="b:value"]')!;
 act(()=>{next.dispatchEvent(new Event('pointerdown',{bubbles:true}));editor.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:next}));});
 expect(base.commitEdit).toHaveBeenCalledTimes(1);
 view.rerender(ui(false));const focus=vi.spyOn(grid,'focus');
 await act(async()=>{complete(true);await pending;});
 expect(focus).not.toHaveBeenCalled();expect(view.container.querySelector('[aria-label="Cell editor"]')).toBeNull();
 view.unmount();focus.mockRestore();
});

it('does not activate or scroll a persistent viewport after an older private cell preparation resolves',async()=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 const base={...adapter([{id:'old',value:'Old'}]),onCellActivated:async({beginEdit}:Parameters<NonNullable<ReturnType<typeof adapter>['onCellActivated']>>[0])=>{await pending;beginEdit();return 'handled' as const;}};
 const config={title:base.title,columns:base.columns,zoomStorageKey:base.zoomStorageKey};
 const ui=(ready:boolean)=><SpreadsheetSurfaceProvider owner={ready?{}:null} config={config}>
  <SpreadsheetSurface toolbar={null} loading loadingMessage="Reading" errorMessage="Unavailable" emptyMessage="Empty"/>{ready?<SpreadsheetPageTemplate adapter={base}/>:null}
 </SpreadsheetSurfaceProvider>;
 const view=renderIntoDocument(ui(true));act(()=>view.container.querySelector<HTMLTableCellElement>('[data-cell-id="old:value"]')!.click());
 view.rerender(ui(false));const scroll=vi.spyOn(Element.prototype,'scrollIntoView');scroll.mockClear();
 await act(async()=>{release();await pending;});expect(scroll).not.toHaveBeenCalled();expect(view.container.querySelector('[aria-label="Cell editor"]')).toBeNull();view.unmount();scroll.mockRestore();
});

it('keeps Job Packs independent of an inactive surrounding root spreadsheet workspace',()=>{
 const base=adapter([{id:'job-pack',value:'Verified installation material'}]);
 const ui=(failed:boolean)=><SpreadsheetWorkspace owner={null} kind={null} entryIdentity="project-job-packs"><SpreadsheetPageTemplate adapter={{...base,hasError:failed}} embedded zoomDockPlacement="viewport"/></SpreadsheetWorkspace>;
 const view=renderIntoDocument(ui(false));expect(view.container.querySelectorAll('table')).toHaveLength(1);const table=view.container.querySelector('table'),head=view.container.querySelector('thead');
 expect(head?.textContent).toContain('Value');expect(head?.textContent).not.toContain('Designer');expect(table?.textContent).toContain('Verified installation material');
 const preset=view.container.querySelector<HTMLSelectElement>('[aria-label="Zoom preset"]')!;act(()=>{preset.value='125';preset.dispatchEvent(new Event('change',{bubbles:true}));});
 view.rerender(ui(true));expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('thead')).toBe(head);expect(preset.value).toBe('125');view.unmount();
});
