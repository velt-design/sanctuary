import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorInfillWorkspace, { type CalculatorInfillWorkspaceProps } from './CalculatorInfillWorkspace';

function makeProps(overrides: Partial<CalculatorInfillWorkspaceProps> = {}): CalculatorInfillWorkspaceProps {
  const presets = [{ key: 'front' as const, label: 'Front infill' }];
  return {
    open: true,
    dialog: {
      closeOnEsc: true,
      onClose: vi.fn(),
      stage: 'opening',
      openingComplete: false,
      blockerCount: 0,
      onStageChange: vi.fn(),
    },
    header: null,
    showUndo: false,
    onUndo: vi.fn(),
    rail: {
      items: [],
      selectedInfillId: null,
      uiById: new Map(),
      rafterSpacingM: 0.9,
      summaryLine1: '0 infills added',
      summaryLine2: 'Front 0 · Side 0 · Gable 0',
      summaryLine3: null,
      hasInfills: false,
      presets,
      onAddCustom: vi.fn(),
      onAddPreset: vi.fn(),
      onSelectInfill: vi.fn(),
      onFocusPrimaryField: vi.fn(),
      onMoveInfill: vi.fn(),
      onRowRef: vi.fn(),
    },
    openingStage: null,
    supportsStage: null,
    resultsStage: null,
    costComparison: null,
    itemCount: 0,
    presets,
    onAddPreset: vi.fn(),
    onAddPresetFromOverview: vi.fn(),
    duplicate: {
      open: false,
      sourceLabel: 'Infill 1',
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    },
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('CalculatorInfillWorkspace', () => {
  it('owns the empty workspace and undo presentation', () => {
    const props = makeProps({ showUndo: true });
    renderIntoDocument(<CalculatorInfillWorkspace {...props} />);

    expect(document.body.textContent).toContain('Choose how you want to start');
    expect(document.body.textContent).toContain('Front infill');
    expect(document.body.textContent).toContain('Infill deleted.');

    const custom = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Add custom infill');
    act(() => custom?.click());
    expect(props.onAddPreset).toHaveBeenCalledWith('custom');

    const undo = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Undo');
    act(() => undo?.click());
    expect(props.onUndo).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while the workspace is closed', () => {
    renderIntoDocument(<CalculatorInfillWorkspace {...makeProps({ open: false })} />);
    expect(document.body.textContent).toBe('');
  });
});
