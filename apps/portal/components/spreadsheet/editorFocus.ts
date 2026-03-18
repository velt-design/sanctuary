import type { SpreadsheetActivationTrigger, SpreadsheetEditingCell } from './types';

export type SpreadsheetEditorElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function moveCaretToEnd(node: HTMLInputElement | HTMLTextAreaElement): void {
  try {
    const end = node.value.length;
    node.setSelectionRange(end, end);
  } catch {
    // Some input types do not support text selection APIs.
  }
}

export function focusEditorForTrigger(node: SpreadsheetEditorElement | null, trigger: SpreadsheetActivationTrigger | null): void {
  if (!node) return;
  node.focus();

  if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return;

  if (trigger === 'enter' || trigger === 'double_click') {
    try {
      node.select();
    } catch {
      // Some input types do not support text selection APIs.
    }
    return;
  }

  if (trigger === 'click' || trigger === 'printable') {
    moveCaretToEnd(node);
  }
}

export function editingSessionKey<TKey extends string, TValue>(editing: SpreadsheetEditingCell<TKey, TValue> | null): string | null {
  return editing ? `${editing.rowId}:${editing.key}` : null;
}
