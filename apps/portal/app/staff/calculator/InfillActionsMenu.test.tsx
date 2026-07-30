import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import InfillActionsMenu from './InfillActionsMenu';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('InfillActionsMenu', () => {
  it('preserves grouped actions and disabled movement/paste states', () => {
    const onDuplicate = vi.fn();
    const rendered = renderIntoDocument(
      <InfillActionsMenu
        disableMoveUp
        disablePaste
        onDuplicate={onDuplicate}
        onDuplicateBulk={vi.fn()}
        onCopyGeometry={vi.fn()}
        onPasteGeometry={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    act(() => (rendered.container.querySelector('button') as HTMLButtonElement).click());
    const menu = document.body.querySelector('[role="menu"]') as HTMLDivElement;
    const itemByText = (text: string) => Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find((item) => item.textContent === text);

    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(3);
    expect(itemByText('Paste geometry')?.disabled).toBe(true);
    expect(itemByText('Move up')?.disabled).toBe(true);
    expect(itemByText('Move down')?.disabled).toBe(false);

    act(() => itemByText('Duplicate')?.click());
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    rendered.unmount();
  });
});
