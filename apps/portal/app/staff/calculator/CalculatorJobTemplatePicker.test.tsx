import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorJobTemplatePicker from './CalculatorJobTemplatePicker';

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorJobTemplatePicker', () => {
  it('applies the selected template immediately without a confirmation dialog', () => {
    const onApply = vi.fn();
    renderIntoDocument(<CalculatorJobTemplatePicker onApply={onApply} />);

    const select = document.querySelector('select[aria-label="Common job template"]') as HTMLSelectElement;
    act(() => {
      select.value = 'attached_gable_acrylic';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => button('Apply to active module').click());

    expect(onApply).toHaveBeenCalledWith('attached_gable_acrylic');
    expect(document.querySelector('[role="dialog"][aria-label="Apply starting template?"]')).toBeNull();
  });
});
