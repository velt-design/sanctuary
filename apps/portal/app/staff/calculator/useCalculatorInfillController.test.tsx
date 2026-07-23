import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import { INFILL_DELETE_UNDO_MS } from './calculatorInfillUi';
import { makeDefaultInfillItem } from './calculatorInputs';
import { useCalculatorInfillController } from './useCalculatorInfillController';

type InfillController = ReturnType<typeof useCalculatorInfillController>;

let latest: InfillController | null = null;

function controller(): InfillController {
  if (!latest) throw new Error('Infill controller probe has not rendered.');
  return latest;
}

function Probe({ items }: { items: Parameters<typeof useCalculatorInfillController>[0]['items'] }) {
  latest = useCalculatorInfillController({ items });
  return null;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCalculatorInfillController', () => {
  it('owns modal flags and keeps selection valid as infills change', () => {
    const first = makeDefaultInfillItem({ id: 'infill-1' });
    const second = makeDefaultInfillItem({ id: 'infill-2' });
    const rendered = renderIntoDocument(<Probe items={[first]} />);

    act(() => controller().openInfills());
    expect(controller().infillsOpen).toBe(true);
    expect(controller().selectedInfillId).toBe(first.id);

    act(() => controller().requestInfillSelection(second.id));
    expect(controller().selectedInfillId).toBe(second.id);

    rendered.rerender(<Probe items={[first, second]} />);
    expect(controller().selectedInfillId).toBe(second.id);

    rendered.rerender(<Probe items={[first]} />);
    expect(controller().selectedInfillId).toBe(first.id);

    act(() => {
      controller().setInfillCostDetailsOpen(true);
      controller().openInfillDuplicate();
    });
    expect(controller().infillCostDetailsOpen).toBe(true);
    expect(controller().infillDuplicateOpen).toBe(true);

    act(() => {
      controller().closeInfills();
      controller().closeInfillDuplicate();
    });
    expect(controller().infillsOpen).toBe(false);
    expect(controller().infillCostDetailsOpen).toBe(false);
    expect(controller().infillDuplicateOpen).toBe(false);

    rendered.unmount();
  });

  it('owns raw shape drafts and prunes drafts for removed infills', () => {
    const first = makeDefaultInfillItem({
      id: 'infill-1',
      shape: { type: 'rect', widthM: '2.4', heightM: '1.1', bottomOffsetM: '0' },
    });
    const second = makeDefaultInfillItem({ id: 'infill-2' });
    const rendered = renderIntoDocument(<Probe items={[first, second]} />);

    expect(controller().getInfillDraftValue(first, 'widthM')).toBe('2.4');
    act(() => {
      controller().setInfillDraftValue(first.id, 'widthM', '2.');
      controller().setInfillDraftValue(first.id, 'heightM', '');
    });
    expect(controller().getInfillDraftValue(first, 'widthM')).toBe('2.');
    expect(controller().getInfillDraftValue(first, 'heightM')).toBe('');

    act(() => controller().clearInfillDraftField(first.id, 'widthM'));
    expect(controller().getInfillDraftValue(first, 'widthM')).toBe('2.4');
    expect(controller().infillDraftById[first.id]).toEqual({ heightM: '' });

    rendered.rerender(<Probe items={[second]} />);
    expect(controller().infillDraftById).toEqual({});

    rendered.unmount();
  });

  it('captures and restores delete-undo state with its draft and selection', () => {
    const first = makeDefaultInfillItem({ id: 'infill-1' });
    const second = makeDefaultInfillItem({ id: 'infill-2' });
    const rendered = renderIntoDocument(<Probe items={[first, second]} />);

    act(() => {
      controller().openInfills();
      controller().selectInfill(first.id);
      controller().setInfillDraftValue(first.id, 'widthM', '3.');
      controller().setInfillStage('supports');
    });

    act(() => controller().deleteInfillState({ infill: first, index: 0, nextSelectionId: second.id }));
    expect(controller().selectedInfillId).toBe(second.id);
    expect(controller().infillDraftById[first.id]).toBeUndefined();
    expect(controller().deletedInfill?.infill.id).toBe(first.id);

    let restored!: NonNullable<ReturnType<InfillController['restoreDeletedInfill']>>;
    act(() => {
      restored = controller().restoreDeletedInfill() as NonNullable<ReturnType<InfillController['restoreDeletedInfill']>>;
    });
    expect(restored.infill.id).toBe(first.id);
    expect(controller().selectedInfillId).toBe(first.id);
    expect(controller().infillDraftById[first.id]).toEqual({ widthM: '3.' });
    expect(controller().infillStage).toBe('opening');
    expect(controller().deletedInfill).toBeNull();

    rendered.unmount();
  });

  it('expires delete-undo state on the established timeout', () => {
    vi.useFakeTimers();
    const first = makeDefaultInfillItem({ id: 'infill-1' });
    const rendered = renderIntoDocument(<Probe items={[first]} />);

    act(() => controller().deleteInfillState({ infill: first, index: 0, nextSelectionId: null }));
    expect(controller().deletedInfill?.infill.id).toBe(first.id);

    act(() => vi.advanceTimersByTime(INFILL_DELETE_UNDO_MS));
    expect(controller().deletedInfill).toBeNull();

    rendered.unmount();
  });

  it('scrolls the selected rail row into view when the modal opens', () => {
    const first = makeDefaultInfillItem({ id: 'infill-1' });
    const rendered = renderIntoDocument(<Probe items={[first]} />);
    const row = document.createElement('button');
    const scrollIntoView = vi.fn();
    row.scrollIntoView = scrollIntoView;

    act(() => {
      controller().setInfillRowRef(first.id, row);
      controller().openInfills();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    rendered.unmount();
  });
});
