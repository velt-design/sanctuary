import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultInfillItem } from './calculatorInputs';
import { infillFieldId, resolveInfillUiState, type InfillWarningItem } from './infillCompute';
import { useCalculatorInfillInteractions } from './useCalculatorInfillInteractions';

type InfillInteractions = ReturnType<typeof useCalculatorInfillInteractions>;

const selectedInfill = makeDefaultInfillItem({
  id: 'infill-a',
  location: 'front',
  shape: { type: 'rect', widthM: '2', heightM: '1', bottomOffsetM: '0' },
});
const selectedInfillEstimate = resolveInfillUiState(selectedInfill, 0.9).estimate;

let latest: InfillInteractions | null = null;

const openInfills = vi.fn();
const closeInfills = vi.fn();
const openInfillDuplicate = vi.fn();
const requestInfillSelection = vi.fn();
const setInfillStage = vi.fn();
const handleInfillStageChange = vi.fn();
const changeSelectedItem = vi.fn();
const duplicateInfill = vi.fn();
const moveInfill = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

function interactions(): InfillInteractions {
  if (!latest) throw new Error('Infill interactions probe has not rendered.');
  return latest;
}

function Probe({
  open = false,
  duplicateOpen = false,
}: {
  open?: boolean;
  duplicateOpen?: boolean;
}) {
  latest = useCalculatorInfillInteractions({
    activeModuleIndex: 0,
    infills: [selectedInfill],
    selectedInfill,
    selectedInfillEstimate,
    selectedWarningCount: 2,
    infillsOpen: open,
    infillDuplicateOpen: duplicateOpen,
    openInfills,
    closeInfills,
    openInfillDuplicate,
    requestInfillSelection,
    setInfillStage,
    handleInfillStageChange,
    changeSelectedItem,
    duplicateInfill,
    moveInfill,
    flashClassName: 'warning-flash',
    notifySuccess,
    notifyError,
  });
  return null;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useCalculatorInfillInteractions', () => {
  it('owns the local geometry clipboard and preserves established notifications', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const rendered = renderIntoDocument(<Probe />);

    act(() => interactions().handlePasteInfillGeometry());
    expect(notifyError).toHaveBeenCalledWith('No geometry copied yet.');
    expect(changeSelectedItem).not.toHaveBeenCalled();

    await act(async () => {
      await interactions().handleCopyInfillGeometry();
    });
    expect(interactions().hasClipboard).toBe(true);
    expect(notifySuccess).toHaveBeenCalledWith('Geometry copied.');

    act(() => interactions().handlePasteInfillGeometry());
    expect(changeSelectedItem).toHaveBeenCalledWith(expect.objectContaining({
      shape: selectedInfill.shape,
      panelOrientation: selectedInfill.panelOrientation,
    }));
    expect(setInfillStage).toHaveBeenCalledWith('opening');
    expect(notifySuccess).toHaveBeenCalledWith('Geometry pasted.');

    rendered.unmount();
  });

  it('wires the established modal hotkeys to selected-item actions', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const rendered = renderIntoDocument(<Probe open />);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true })));
    expect(duplicateInfill).toHaveBeenCalledWith('infill-a');

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true })));
    expect(moveInfill).toHaveBeenCalledWith('infill-a', 1);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(closeInfills).toHaveBeenCalledTimes(1);

    rendered.rerender(<Probe open duplicateOpen />);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(closeInfills).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('moves warning focus to the selected field and flashes the target', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const rendered = renderIntoDocument(<Probe />);
    const warning: InfillWarningItem = {
      id: 'missing-width',
      severity: 'error',
      message: 'Enter a width.',
      target: { section: 'basic', fieldKey: 'shape-width' },
    };
    const field = document.createElement('input');
    field.id = infillFieldId(selectedInfill.id, warning.target.fieldKey);
    field.scrollIntoView = vi.fn();
    document.body.appendChild(field);

    act(() => interactions().jumpToInfillWarningTarget(warning));

    expect(handleInfillStageChange).toHaveBeenCalledWith('opening');
    expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(document.activeElement).toBe(field);
    expect(field.classList.contains('warning-flash')).toBe(true);

    act(() => vi.advanceTimersByTime(900));
    expect(field.classList.contains('warning-flash')).toBe(false);

    rendered.unmount();
  });

  it('opens and selects a global warning target before deferred focus', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const rendered = renderIntoDocument(<Probe />);
    const warning: InfillWarningItem = {
      id: 'support-top',
      severity: 'warning',
      message: 'Confirm the top support.',
      target: { section: 'supports', fieldKey: 'support-top' },
    };

    act(() => interactions().jumpToInfillWarningGlobal('infill-b', warning));

    expect(openInfills).toHaveBeenCalledTimes(1);
    expect(requestInfillSelection).toHaveBeenCalledWith('infill-b');

    rendered.unmount();
  });
});
