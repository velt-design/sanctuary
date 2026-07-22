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
  it('requires confirmation before replacing the active module', () => {
    const onApply = vi.fn();
    renderIntoDocument(
      <CalculatorJobTemplatePicker activeModuleLabel="Pool cover · Module 1" onApply={onApply} />,
    );

    const select = document.querySelector('select[aria-label="Common job template"]') as HTMLSelectElement;
    act(() => {
      select.value = 'attached_gable_acrylic';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => button('Apply to active module').click());

    const dialog = document.querySelector('[role="dialog"][aria-label="Apply starting template?"]') as HTMLElement;
    expect(dialog.textContent).toContain('Pool cover · Module 1');
    expect(dialog.textContent).toContain('Attached gable acrylic');
    expect(dialog.textContent).toContain('Pergola name and site-level allowances stay unchanged');
    expect(onApply).not.toHaveBeenCalled();

    act(() => button('Apply template').click());
    expect(onApply).toHaveBeenCalledWith('attached_gable_acrylic');
  });
});
