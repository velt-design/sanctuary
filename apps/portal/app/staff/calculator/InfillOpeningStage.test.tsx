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
        automaticChoicesOpen={false}
        acrylicAutoSwitched={false}
        resolvedAcrylicSource="sheet_panels"
        resolvedAcrylicLabel="Sheet panels"
        preview={<div>Opening diagram</div>}
        getDraftValue={(field) => field === 'widthM' ? '1' : '1'}
        onAutomaticChoicesToggle={vi.fn()}
        onItemChange={vi.fn()}
        onLocationChange={vi.fn()}
        onAcrylicPreferenceChange={vi.fn()}
        onShapeTypeChange={vi.fn()}
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
    expect(content).toContain('Bottom installation height');
    expect(content).toContain('does not change its cut size');

    unmount();
  });
});
