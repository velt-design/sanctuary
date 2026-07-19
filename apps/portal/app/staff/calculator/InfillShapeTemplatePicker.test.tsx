import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import InfillShapeTemplatePicker from './InfillShapeTemplatePicker';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('InfillShapeTemplatePicker', () => {
  it('renders three accessible visual choices and reports the selected template', () => {
    const onChange = vi.fn();
    const { container, unmount } = renderIntoDocument(
      <InfillShapeTemplatePicker domIdBase="opening" value="rectangle" onChange={onChange} />,
    );

    expect(container.querySelector('fieldset')?.textContent).toContain('Opening shape');
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
    expect(container.textContent).toContain('Same height on both sides');
    expect(container.textContent).toContain('One side higher than the other');
    expect(container.textContent).toContain('Tapers to a point on one side');
    expect(container.querySelector('input[value="rectangle"]:checked')).not.toBeNull();
    expect(container.textContent?.match(/Selected/g)).toHaveLength(1);

    const triangle = container.querySelector('input[value="triangle"]');
    if (!(triangle instanceof HTMLInputElement)) throw new Error('Missing triangle template.');
    act(() => triangle.click());
    expect(onChange).toHaveBeenCalledWith('triangle');

    unmount();
  });
});
