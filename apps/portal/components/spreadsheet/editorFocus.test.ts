import { describe, expect, it, vi } from 'vitest';
import { editingSessionKey, focusEditorForTrigger } from './editorFocus';

describe('editingSessionKey', () => {
  it('stays stable while only the editor value changes', () => {
    expect(
      editingSessionKey({
        rowId: 'row_1',
        key: 'notes',
        value: 'A',
      }),
    ).toBe(
      editingSessionKey({
        rowId: 'row_1',
        key: 'notes',
        value: 'Alpha',
      }),
    );
  });
});

describe('focusEditorForTrigger', () => {
  it('moves the caret to the end for click edits without selecting all text', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Alpha';
    document.body.appendChild(input);

    const selectSpy = vi.spyOn(input, 'select');

    focusEditorForTrigger(input, 'click');

    expect(document.activeElement).toBe(input);
    expect(selectSpy).not.toHaveBeenCalled();
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);

    input.remove();
  });

  it('selects all text for enter-driven edits', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Alpha';
    document.body.appendChild(input);

    const selectSpy = vi.spyOn(input, 'select');

    focusEditorForTrigger(input, 'enter');

    expect(selectSpy).toHaveBeenCalledTimes(1);

    input.remove();
  });

  it('places the caret after a seeded printable edit', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Z';
    document.body.appendChild(input);

    const selectSpy = vi.spyOn(input, 'select');

    focusEditorForTrigger(input, 'printable');

    expect(selectSpy).not.toHaveBeenCalled();
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);

    input.remove();
  });
});
