'use client';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpreadsheetPageTemplate from './SpreadsheetPageTemplate';
import type { SpreadsheetAdapter } from './types';

type TestRow = {
  id: string;
  notes: string;
};

function makeAdapter(): SpreadsheetAdapter<TestRow, 'notes', 'notes', string> {
  const row: TestRow = { id: 'row_1', notes: 'Alpha' };

  return {
    title: 'Test Sheet',
    toolbar: null,
    columns: [{ key: 'notes', letter: 'A', label: 'Notes', widthPx: 180, editable: true, frozen: true }],
    allRows: [row],
    rowNumberRows: [row],
    groups: [{ key: 'group_2026', label: '2026', rows: [row] }],
    zoomStorageKey: 'spreadsheet_page_template_test_zoom',
    defaultActiveKey: 'notes',
    loading: false,
    hasError: false,
    loadingMessage: 'Loading...',
    errorMessage: 'Error',
    emptyMessage: 'Empty',
    savingCells: {},
    conflictCells: {},
    getRowId: (item) => item.id,
    isEditableKey: (key): key is 'notes' => key === 'notes',
    getRowClassName: () => '',
    getCellClassName: () => '',
    formatCellValue: (item) => item.notes,
    renderCellContent: ({ text }) => text,
    getEditorValue: (item) => item.notes,
    renderEditor: ({ value, setValue, editorRef, onBlur, commit, cancel }) => (
      <input
        ref={editorRef}
        type="text"
        value={value}
        onBlur={() => {
          void onBlur();
        }}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancel();
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          }
        }}
      />
    ),
    commitEdit: async () => true,
    onCellActivated: ({ trigger, seed, beginEdit }) => {
      if (trigger === 'click' || trigger === 'enter' || trigger === 'double_click') {
        beginEdit();
        return 'handled';
      }
      if (trigger === 'printable' && seed) {
        beginEdit(seed);
        return 'handled';
      }
      return 'noop';
    },
  };
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const setter = descriptor?.set;
  if (!setter) throw new Error('Missing native input value setter.');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SpreadsheetPageTemplate', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();

    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        configurable: true,
      });
    } else {
      vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    }
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('opens a clicked text cell without selecting all of its contents', async () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select').mockImplementation(function thisSelect(this: HTMLInputElement) {
      this.setSelectionRange(0, this.value.length);
    });

    await act(async () => {
      root.render(<SpreadsheetPageTemplate adapter={makeAdapter()} />);
    });

    const cell = container.querySelector('tbody td');
    expect(cell).toBeTruthy();

    await act(async () => {
      cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector('input');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(document.activeElement).toBe(input);
    expect(selectSpy).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).selectionStart).toBe('Alpha'.length);
    expect((input as HTMLInputElement).selectionEnd).toBe('Alpha'.length);
  });

  it('selects once on enter, then keeps the caret stable while the value changes', async () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select').mockImplementation(function thisSelect(this: HTMLInputElement) {
      this.setSelectionRange(0, this.value.length);
    });

    await act(async () => {
      root.render(<SpreadsheetPageTemplate adapter={makeAdapter()} />);
    });

    const grid = container.querySelector('div[tabindex="0"]');
    expect(grid).toBeTruthy();
    (grid as HTMLDivElement).focus();

    await act(async () => {
      grid?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const input = container.querySelector('input') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    expect(selectSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      setNativeInputValue(input as HTMLInputElement, 'Beta');
    });

    expect((input as HTMLInputElement).value).toBe('Beta');
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it('seeds printable edits and places the caret after the seeded value', async () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select').mockImplementation(function thisSelect(this: HTMLInputElement) {
      this.setSelectionRange(0, this.value.length);
    });

    await act(async () => {
      root.render(<SpreadsheetPageTemplate adapter={makeAdapter()} />);
    });

    const grid = container.querySelector('div[tabindex="0"]');
    expect(grid).toBeTruthy();
    (grid as HTMLDivElement).focus();

    await act(async () => {
      grid?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', bubbles: true }));
    });

    const input = container.querySelector('input') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    expect(input?.value).toBe('Z');
    expect(selectSpy).not.toHaveBeenCalled();
    expect(input?.selectionStart).toBe(1);
    expect(input?.selectionEnd).toBe(1);
  });
});
