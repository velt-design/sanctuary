import type { Dispatch, SetStateAction } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CalculatorInputs } from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import {
  makeDefaultCalculatorInputs,
  makeDefaultInfillItem,
  makeDefaultModule,
} from './calculatorInputs';
import { resolveInfillUiState } from './infillCompute';
import { useCalculatorInfillActions } from './useCalculatorInfillActions';

type InfillActions = ReturnType<typeof useCalculatorInfillActions>;

let latest: InfillActions | null = null;
let values: CalculatorInputs;
let selectedId = 'infill-a';
let standalone = false;

const requestInfillSelection = vi.fn();
const setInfillStage = vi.fn();
const setInfillDraftValue = vi.fn();
const clearInfillDraftField = vi.fn();
const clearInfillDraft = vi.fn();
const deleteInfillState = vi.fn();
const restoreDeletedInfill = vi.fn();
const closeInfillDuplicate = vi.fn();

function actions(): InfillActions {
  if (!latest) throw new Error('Infill actions probe has not rendered.');
  return latest;
}

function resetValues() {
  const first = makeDefaultInfillItem({
    id: 'infill-a',
    label: 'Wall',
    shape: { type: 'rect', widthM: '2', heightM: '1', bottomOffsetM: '0' },
  });
  const second = makeDefaultInfillItem({
    id: 'infill-b',
    label: 'Wall (copy 1)',
    shape: { type: 'rect', widthM: '1.5', heightM: '1', bottomOffsetM: '0' },
  });
  values = {
    ...makeDefaultCalculatorInputs(),
    modules: [{
      ...makeDefaultModule('pergola-1'),
      infills: { items: [first, second] },
    }],
  };
}

const setValues: Dispatch<SetStateAction<CalculatorInputs>> = (update) => {
  values = typeof update === 'function' ? update(values) : update;
};

function Probe() {
  const activeModule = values.modules[0] ?? makeDefaultModule('pergola-1');
  const infills = standalone ? values.standaloneInfills?.items ?? [] : activeModule.infills?.items ?? [];
  const selectedInfill = infills.find((item) => item.id === selectedId) ?? null;
  const selectedInfillEstimate = selectedInfill
    ? resolveInfillUiState(selectedInfill, 0.9, undefined, Number(activeModule.lengthM)).estimate
    : null;

  latest = useCalculatorInfillActions({
    activeModule,
    activeModuleIndex: 0,
    activePergolaId: 'pergola-1',
    infills,
    setValues,
    standalone,
    selectedInfill,
    selectedInfillEstimate,
    selectedCanOfferRafterMatching: false,
    selectedWarningCount: 0,
    infillsOpen: false,
    infillDuplicateOpen: false,
    openInfills: vi.fn(),
    closeInfills: vi.fn(),
    openInfillDuplicate: vi.fn(),
    closeInfillDuplicate,
    requestInfillSelection,
    setInfillStage,
    setInfillDraftValue,
    clearInfillDraftField,
    clearInfillDraft,
    getInfillDraftValue: (item, field) => {
      if (field === 'widthM') return item.shape.widthM;
      if (field === 'heightM') return item.shape.type === 'rect' ? item.shape.heightM : '';
      if (field === 'heightLowM') return item.shape.type === 'mono_slope' ? item.shape.heightLowM : '';
      return item.shape.type === 'mono_slope' ? item.shape.heightHighM : '';
    },
    deleteInfillState,
    restoreDeletedInfill,
    flashClassName: 'flash',
    notifySuccess: vi.fn(),
    notifyError: vi.fn(),
  });
  return null;
}

afterEach(() => {
  latest = null;
  selectedId = 'infill-a';
  standalone = false;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useCalculatorInfillActions', () => {
  it('writes standalone add-on infills without creating a pergola or module', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    standalone = true;
    const first = makeDefaultInfillItem({ id: 'infill-a', label: 'Existing wall' });
    values = {
      ...makeDefaultCalculatorInputs(),
      pergolas: [],
      modules: [],
      standaloneInfills: { extrusionColour: 'Black', items: [first] },
    };
    const rendered = renderIntoDocument(<Probe />);

    act(() => actions().changeSelectedItem({ label: 'Updated existing wall' }));

    expect(values.standaloneInfills?.items[0]?.label).toBe('Updated existing wall');
    expect(values.pergolas).toEqual([]);
    expect(values.modules).toEqual([]);
    rendered.unmount();
  });

  it('owns selected-item edits, draft commits, and location lifecycle actions', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    resetValues();
    const rendered = renderIntoDocument(<Probe />);

    act(() => actions().changeSelectedItem({ label: 'Updated wall' }));
    expect(values.modules[0].infills?.items[0]?.label).toBe('Updated wall');

    rendered.rerender(<Probe />);
    act(() => actions().changeSelectedDraft('widthM', '2.'));
    expect(setInfillDraftValue).toHaveBeenCalledWith('infill-a', 'widthM', '2.');

    act(() => actions().commitSelectedDraft('widthM', '2.5'));
    expect(values.modules[0].infills?.items[0]?.shape.widthM).toBe('2.5');
    expect(clearInfillDraftField).toHaveBeenCalledWith('infill-a', 'widthM');

    rendered.rerender(<Probe />);
    act(() => actions().changeSelectedLocation('house'));
    expect(values.modules[0].infills?.items[0]?.location).toBe('house');
    expect(clearInfillDraft).toHaveBeenCalledWith('infill-a');
    expect(setInfillStage).toHaveBeenLastCalledWith('opening');

    rendered.unmount();
  });

  it('owns reorder, delete, and undo mutations without changing item identity', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    resetValues();
    const rendered = renderIntoDocument(<Probe />);

    act(() => actions().moveInfill('infill-a', 1));
    expect(values.modules[0].infills?.items.map((item) => item.id)).toEqual(['infill-b', 'infill-a']);
    expect(requestInfillSelection).toHaveBeenCalledWith('infill-a');

    rendered.rerender(<Probe />);
    act(() => actions().deleteSelectedInfill());
    expect(values.modules[0].infills?.items.map((item) => item.id)).toEqual(['infill-b']);
    expect(deleteInfillState).toHaveBeenCalledWith(expect.objectContaining({
      infill: expect.objectContaining({ id: 'infill-a' }),
      index: 1,
      nextSelectionId: 'infill-b',
    }));

    const deleted = deleteInfillState.mock.calls[0]?.[0];
    restoreDeletedInfill.mockReturnValue(deleted);
    rendered.rerender(<Probe />);
    act(() => actions().undoDeleteInfill());
    expect(values.modules[0].infills?.items.map((item) => item.id)).toEqual(['infill-b', 'infill-a']);

    rendered.unmount();
  });

  it('builds bounded bulk duplicates with unique labels and closes the dialog', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    resetValues();
    const rendered = renderIntoDocument(<Probe />);

    act(() => actions().confirmSelectedDuplicate({ count: 2, labelPattern: '{original}' }));

    const items = values.modules[0].infills?.items ?? [];
    expect(items).toHaveLength(4);
    expect(items.slice(2).map((item) => item.label)).toEqual(['Wall (2)', 'Wall (3)']);
    expect(new Set(items.map((item) => item.id)).size).toBe(4);
    expect(requestInfillSelection).toHaveBeenCalledWith(items[3]?.id);
    expect(setInfillStage).toHaveBeenCalledWith('opening');
    expect(closeInfillDuplicate).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('owns opening and support stage policy for the selected infill', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    resetValues();
    values.modules[0].infills = {
      items: [makeDefaultInfillItem({
        id: 'infill-a',
        acrylicSource: 'auto',
        panelOrientation: 'auto',
        widthMode: 'match_roof_rafters',
        shape: {
          type: 'mono_slope',
          widthM: '2',
          heightLowM: '1',
          heightHighM: '1.5',
          bottomOffsetM: '0',
          slopeMode: 'heights',
          slopeDeg: '',
          slopeAnchor: 'left',
        },
      })],
    };
    const rendered = renderIntoDocument(<Probe />);

    act(() => actions().handleInfillStageChange('supports'));
    expect(values.modules[0].infills?.items[0]).toMatchObject({
      acrylicSource: expect.not.stringMatching(/^auto$/),
      panelOrientation: expect.not.stringMatching(/^auto$/),
    });
    expect(setInfillStage).toHaveBeenCalledWith('supports');

    rendered.rerender(<Probe />);
    act(() => actions().changeSelectedMonoMode('pitch'));
    expect(values.modules[0].infills?.items[0]?.shape).toMatchObject({
      type: 'mono_slope',
      slopeMode: 'pitch',
      slopeDeg: expect.any(String),
    });

    rendered.rerender(<Probe />);
    act(() => actions().changeSelectedInternalMode('none'));
    expect(values.modules[0].infills?.items[0]).toMatchObject({
      widthMode: 'target_width',
      support: { internalSupportMode: 'none' },
    });

    rendered.unmount();
  });
});
