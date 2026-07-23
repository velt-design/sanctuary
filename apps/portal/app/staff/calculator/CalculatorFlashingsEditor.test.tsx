import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CalculatorFlashingsState } from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorFlashingsEditor from './CalculatorFlashingsEditor';

const primaryRow: CalculatorFlashingsState['rows'][number] = {
  id: 'primary',
  kind: 'primary',
  band: '201-300',
  lengthM: '6',
  purpose: 'HEAD',
};

const extraRow: CalculatorFlashingsState['rows'][number] = {
  id: 'extra-1',
  kind: 'extra',
  band: '0-200',
  lengthM: '2',
  purpose: 'SIDE',
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorFlashingsEditor', () => {
  it('renders totals, forwards row edits, and reveals all bands', () => {
    const onUpdateRow = vi.fn();
    const onRemoveRow = vi.fn();
    renderIntoDocument(
      <CalculatorFlashingsEditor
        state={{ rows: [primaryRow, extraRow] }}
        primaryRow={primaryRow}
        onAddRow={() => 'extra-2'}
        onUpdateRow={onUpdateRow}
        onRemoveRow={onRemoveRow}
      />,
    );

    expect(document.body.textContent).toContain('8.0 m');
    const toggle = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Show all bands');
    expect(toggle?.parentElement?.textContent).not.toContain('301-400');

    const length = document.querySelector('#flashing-row-length-extra-1') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(length, '2.5');
      length.dispatchEvent(new Event('input', { bubbles: true }));
      length.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onUpdateRow).toHaveBeenCalledWith('extra-1', { lengthM: '2.5' });

    act(() => (document.querySelector('[aria-label="Remove row"]') as HTMLButtonElement).click());
    expect(onRemoveRow).toHaveBeenCalledWith('extra-1');

    act(() => toggle?.click());
    expect(toggle?.parentElement?.textContent).toContain('301-400');
  });

  it('focuses the new row length after adding an extra flashing', () => {
    function Probe() {
      const [state, setState] = useState<CalculatorFlashingsState>({ rows: [primaryRow] });
      return (
        <CalculatorFlashingsEditor
          state={state}
          primaryRow={primaryRow}
          onAddRow={() => {
            setState((current) => ({ ...current, rows: [...current.rows, { ...extraRow, id: 'extra-2' }] }));
            return 'extra-2';
          }}
          onUpdateRow={() => undefined}
          onRemoveRow={() => undefined}
        />
      );
    }

    renderIntoDocument(<Probe />);
    const add = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === '+ Add flashing row');
    act(() => add?.click());

    expect(document.activeElement?.id).toBe('flashing-row-length-extra-2');
  });
});
