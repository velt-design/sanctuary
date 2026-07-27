import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BlindLineItem } from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorBlindsEditor from './CalculatorBlindsEditor';
import { buildCalculatorBlindsUi, formatBlindMetresInput } from './calculatorBlindUi';

const item: BlindLineItem = {
  id: 'blind-1',
  label: 'West blind',
  system: 'ZIPTRAK',
  widthMm: '2400',
  coverLengthMm: '2100',
  fabric: 'MESH',
  motorised: 'NONE',
  rollCover: 'NONE',
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorBlindsEditor', () => {
  it('renders blind pricing and forwards editor actions without owning calculator state', () => {
    const onDimensionChange = vi.fn();
    const onDimensionCommit = vi.fn();
    const onItemChange = vi.fn();
    const onDuplicate = vi.fn();
    const onRemove = vi.fn();
    const onAdd = vi.fn();

    renderIntoDocument(
      <CalculatorBlindsEditor
        ui={buildCalculatorBlindsUi([item])}
        fieldPrefix="blind-fields"
        displayDimensionInput={(blind, field) => formatBlindMetresInput(blind[field])}
        onDimensionChange={onDimensionChange}
        onDimensionCommit={onDimensionCommit}
        onItemChange={onItemChange}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        onAdd={onAdd}
      />,
    );

    expect(document.body.textContent).toContain('Blind 1');
    expect(document.body.textContent).toContain('Blinds total (inc‑GST)');
    expect((document.querySelector('#blind-fields-blind-1-width') as HTMLInputElement).value).toBe('2.4');

    const buttons = Array.from(document.querySelectorAll('button'));
    act(() => buttons.find((button) => button.textContent === 'Duplicate')?.click());
    act(() => buttons.find((button) => button.textContent === 'Delete')?.click());
    act(() => buttons.find((button) => button.textContent === 'Add blind')?.click());

    expect(onDuplicate).toHaveBeenCalledWith('blind-1');
    expect(onRemove).toHaveBeenCalledWith('blind-1');
    expect(onAdd).toHaveBeenCalledWith();

    const system = document.querySelector('#blind-fields-blind-1-system') as HTMLSelectElement;
    act(() => {
      system.value = 'OMNI';
      system.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onItemChange).toHaveBeenCalledWith('blind-1', { system: 'OMNI' });

    const width = document.querySelector('#blind-fields-blind-1-width') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(width, '2.5');
      width.dispatchEvent(new Event('input', { bubbles: true }));
      width.dispatchEvent(new Event('change', { bubbles: true }));
      width.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(onDimensionChange).toHaveBeenCalledWith('blind-1', 'widthMm', '2.5');
    expect(onDimensionCommit).toHaveBeenCalledWith('blind-1', 'widthMm');
  });
});
