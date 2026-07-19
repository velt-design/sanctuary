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
  it('shows explicit system selections and only Yes or No edge choices', () => {
    const item = makeDefaultInfillItem();
    const onSupportChange = vi.fn();
    const onAcrylicSourceChange = vi.fn();
    const onPanelOrientationChange = vi.fn();
    const { container, unmount } = renderIntoDocument(
      <InfillSupportsStage
        item={item}
        domIdBase="infill-test"
        canOfferRafterMatching={false}
        additionalSupportSummary="4 new supports are included."
        acrylicSource="sheet_panels"
        panelOrientation="vertical"
        preview={<div>Support diagram</div>}
        onAcrylicSourceChange={onAcrylicSourceChange}
        onPanelOrientationChange={onPanelOrientationChange}
        onSupportChange={onSupportChange}
        onInternalModeChange={vi.fn()}
        onCustomPositionsChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('fieldset')).toHaveLength(4);
    expect(container.querySelectorAll('input[value="no"]:checked')).toHaveLength(4);
    expect(container.querySelectorAll('input[value="unsure"]')).toHaveLength(0);
    expect(container.textContent).not.toContain('Not sure');
    expect(container.textContent).toContain('Panel material');
    expect(container.textContent).toContain('Joiner direction');
    expect(container.textContent).toContain('4 new supports are included.');
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);

    const material = container.querySelector('#infill-test-acrylic');
    const direction = container.querySelector('#infill-test-joiner-direction');
    if (!(material instanceof HTMLSelectElement) || !(direction instanceof HTMLSelectElement)) {
      throw new Error('Missing explicit system selections.');
    }
    act(() => {
      material.value = 'strip_620';
      material.dispatchEvent(new Event('change', { bubbles: true }));
      direction.value = 'horizontal';
      direction.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onAcrylicSourceChange).toHaveBeenCalledWith('strip_620');
    expect(onPanelOrientationChange).toHaveBeenCalledWith('horizontal');

    const topYes = container.querySelector('input[name="infill-test-support-top-choice"][value="yes"]');
    if (!(topYes instanceof HTMLInputElement)) throw new Error('Missing top-edge yes choice.');
    act(() => topYes.click());
    expect(onSupportChange).toHaveBeenCalledWith(expect.objectContaining({
      hasTop: true,
      hasBottom: false,
      edgeConfirmations: expect.objectContaining({ top: 'yes', bottom: 'no' }),
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
        acrylicSource="sheet_panels"
        panelOrientation="vertical"
        preview={<div>Triangle support diagram</div>}
        onAcrylicSourceChange={vi.fn()}
        onPanelOrientationChange={vi.fn()}
        onSupportChange={vi.fn()}
        onInternalModeChange={vi.fn()}
        onCustomPositionsChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('fieldset')).toHaveLength(3);
    expect(container.querySelector('input[name="triangle-supports-support-left-choice"]')).toBeNull();
    expect(container.textContent).toContain('Triangle point');
    expect(container.textContent).toContain('no fixing edge or support required');
    expect(container.textContent).toContain('3 new supports are included.');

    unmount();
  });
});
