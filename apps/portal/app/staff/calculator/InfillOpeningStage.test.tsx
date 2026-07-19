import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultInfillItem } from './calculatorInputs';
import InfillOpeningStage from './InfillOpeningStage';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('InfillOpeningStage', () => {
  it('places location and dimensions before optional identification fields', () => {
    const item = makeDefaultInfillItem();
    const { container, unmount } = renderIntoDocument(
      <InfillOpeningStage
        item={item}
        domIdBase="infill-opening"
        errors={{}}
        preview={<div>Opening diagram</div>}
        getDraftValue={(field) => field === 'widthM' ? '1' : '1'}
        onItemChange={vi.fn()}
        onLocationChange={vi.fn()}
        onShapeTemplateChange={vi.fn()}
        onDraftChange={vi.fn()}
        onDraftCommit={vi.fn()}
        onMonoModeChange={vi.fn()}
        onMonoAnchorChange={vi.fn()}
        onMonoSlopeChange={vi.fn()}
        onBottomOffsetChange={vi.fn()}
      />,
    );

    const content = container.textContent ?? '';
    expect(content.indexOf('Location')).toBeLessThan(content.indexOf('Label'));
    expect(content.indexOf('Width (m)')).toBeLessThan(content.indexOf('Quantity'));
    expect(content).toContain('Rectangle');
    expect(content).toContain('Sloping top');
    expect(content).toContain('Triangle');
    expect(container.querySelector('[id$="shape-type"]')).toBeNull();
    expect(content).toContain('Bottom installation height');
    expect(content).toContain('does not change its cut size');
    expect(content).not.toContain('Change automatic choices');
    expect(content).not.toContain('Panel material');
    expect(content).not.toContain('Joiner direction');

    unmount();
  });

  it('shows only the dimensions needed for a true triangle', () => {
    const item = makeDefaultInfillItem({
      shape: {
        type: 'mono_slope',
        widthM: '2',
        heightLowM: '0',
        heightHighM: '1.5',
        bottomOffsetM: '0',
        slopeMode: 'heights',
        slopeDeg: '',
        slopeAnchor: 'left',
      },
    });
    const { container, unmount } = renderIntoDocument(
      <InfillOpeningStage
        item={item}
        domIdBase="triangle-opening"
        errors={{}}
        preview={<div>Triangle diagram</div>}
        getDraftValue={(field) => field === 'widthM' ? '2' : field === 'heightHighM' ? '1.5' : '0'}
        onItemChange={vi.fn()}
        onLocationChange={vi.fn()}
        onShapeTemplateChange={vi.fn()}
        onDraftChange={vi.fn()}
        onDraftCommit={vi.fn()}
        onMonoModeChange={vi.fn()}
        onMonoAnchorChange={vi.fn()}
        onMonoSlopeChange={vi.fn()}
        onBottomOffsetChange={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Peak height (m)');
    expect(container.textContent).not.toContain('High side');
    expect(container.textContent).not.toContain('High on left');
    expect(container.textContent).not.toContain('High on right');
    expect(container.textContent).not.toContain('Describe the sloping top');

    unmount();
  });

  it('keeps untouched blank required fields calm until they are blurred', () => {
    const item = makeDefaultInfillItem();
    const onDraftCommit = vi.fn();
    const { container, unmount } = renderIntoDocument(
      <InfillOpeningStage
        item={item}
        domIdBase="calm-opening"
        errors={{ widthM: 'Required field.', heightM: 'Required field.' }}
        preview={<div>Opening diagram</div>}
        getDraftValue={() => ''}
        onItemChange={vi.fn()}
        onLocationChange={vi.fn()}
        onShapeTemplateChange={vi.fn()}
        onDraftChange={vi.fn()}
        onDraftCommit={onDraftCommit}
        onMonoModeChange={vi.fn()}
        onMonoAnchorChange={vi.fn()}
        onMonoSlopeChange={vi.fn()}
        onBottomOffsetChange={vi.fn()}
      />,
    );

    expect(container.textContent).not.toContain('Required field.');
    const width = container.querySelector('#calm-opening-shape-width');
    if (!(width instanceof HTMLInputElement)) throw new Error('Missing width input.');
    act(() => {
      width.focus();
      width.blur();
    });
    expect(container.textContent).toContain('Required field.');
    expect(onDraftCommit).toHaveBeenCalledWith('widthM', '');

    unmount();
  });
});
