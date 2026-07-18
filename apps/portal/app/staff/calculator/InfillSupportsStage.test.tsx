import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultInfillItem } from './calculatorInputs';
import InfillSupportsStage from './InfillSupportsStage';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('InfillSupportsStage', () => {
  it('shows explicit accessible choices and maps unsure to a planned support', () => {
    const item = makeDefaultInfillItem();
    const onSupportChange = vi.fn();
    const { container, unmount } = renderIntoDocument(
      <InfillSupportsStage
        item={item}
        domIdBase="infill-test"
        canOfferRafterMatching={false}
        additionalSupportSummary="4 new supports are included."
        preview={<div>Support diagram</div>}
        onSupportChange={onSupportChange}
        onInternalModeChange={vi.fn()}
        onCustomPositionsChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('fieldset')).toHaveLength(4);
    expect(container.querySelectorAll('input[value="unsure"]:checked')).toHaveLength(4);
    expect(container.textContent).toContain('Not sure — include a support');
    expect(container.textContent).toContain('Top, Bottom, Left and Right edges were not confirmed');

    const topYes = container.querySelector('input[name="infill-test-support-top-choice"][value="yes"]');
    if (!(topYes instanceof HTMLInputElement)) throw new Error('Missing top-edge yes choice.');
    act(() => topYes.click());
    expect(onSupportChange).toHaveBeenCalledWith(expect.objectContaining({
      hasTop: true,
      hasBottom: false,
      edgeConfirmations: expect.objectContaining({ top: 'yes', bottom: 'unsure' }),
    }));

    unmount();
  });
});
