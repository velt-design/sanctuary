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
    expect(container.textContent).toContain('4 new supports are included. Unconfirmed edges: top, bottom, left and right.');
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);

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

  it('replaces a triangle point with guidance instead of asking about a nonexistent edge', () => {
    const item = makeDefaultInfillItem({
      shape: {
        type: 'mono_slope',
        widthM: '2',
        heightLowM: '0',
        heightHighM: '1.5',
        slopeMode: 'heights',
      },
    });
    const { container, unmount } = renderIntoDocument(
      <InfillSupportsStage
        item={item}
        domIdBase="triangle-supports"
        canOfferRafterMatching={false}
        additionalSupportSummary="3 new supports are included."
        preview={<div>Triangle support diagram</div>}
        onSupportChange={vi.fn()}
        onInternalModeChange={vi.fn()}
        onCustomPositionsChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('fieldset')).toHaveLength(3);
    expect(container.querySelector('input[name="triangle-supports-support-left-choice"]')).toBeNull();
    expect(container.textContent).toContain('Triangle point');
    expect(container.textContent).toContain('no fixing edge or support required');
    expect(container.textContent).toContain('3 new supports are included. Unconfirmed edges: top, bottom and right.');
    expect(container.textContent).not.toContain('top, bottom, left and right');

    unmount();
  });
});
