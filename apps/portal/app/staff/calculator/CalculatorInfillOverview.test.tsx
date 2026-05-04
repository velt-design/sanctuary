import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InfillLineItem } from '@/lib/types/calculator';
import {
  CalculatorInfillRail,
  CalculatorInfillTile,
  type InfillPresetCard,
} from './CalculatorInfillOverview';
import { estimateInfillUi } from './calculatorInfillUi';

const noop = () => undefined;

const presets: InfillPresetCard[] = [
  { key: 'front', label: 'Front infill' },
  { key: 'side', label: 'Side infill' },
];

function makeInfill(overrides?: Partial<InfillLineItem>): InfillLineItem {
  return {
    id: 'infill-1',
    label: 'Front screen',
    qty: '1',
    location: 'front',
    acrylicSource: 'sheet_panels',
    panelOrientation: 'vertical',
    widthMode: 'target_width',
    targetPanelWidthM: '1.2',
    maxPanelWidthM: '1.2',
    support: {
      hasTop: true,
      hasBottom: true,
      hasLeft: true,
      hasRight: true,
      internalSupportMode: 'none',
      internalSupportPositionsM: [],
    },
    shape: {
      type: 'rect',
      widthM: '2.4',
      heightM: '2.1',
      bottomOffsetM: '0',
    },
    ...overrides,
  };
}

describe('CalculatorInfillOverview', () => {
  it('renders the empty infill tile actions and copy', () => {
    const markup = renderToStaticMarkup(
      <CalculatorInfillTile
        hasInfills={false}
        summaryLine1="0 infills added"
        summaryChips={[
          { key: 'front', label: 'Front', count: 0 },
          { key: 'side', label: 'Side', count: 0 },
        ]}
        systemSummary="Not configured"
        totals={{ panels: 0, mullions: 0 }}
        presets={presets}
        onAddCustom={noop}
        onAddPreset={noop}
        onOpenInfills={noop}
      />,
    );

    expect(markup).toContain('No infills added yet');
    expect(markup).toContain('Add infill');
    expect(markup).toContain('Use preset');
    expect(markup).toContain('Edit infills');
  });

  it('renders populated tile summary metrics', () => {
    const markup = renderToStaticMarkup(
      <CalculatorInfillTile
        hasInfills
        summaryLine1="2 infills added"
        summaryChips={[
          { key: 'front', label: 'Front', count: 1 },
          { key: 'side', label: 'Side', count: 1 },
        ]}
        systemSummary="Mixed systems"
        totals={{ panels: 5, mullions: 3 }}
        presets={presets}
        onAddCustom={noop}
        onAddPreset={noop}
        onOpenInfills={noop}
      />,
    );

    expect(markup).toContain('2 infills added');
    expect(markup).toContain('Mixed systems');
    expect(markup).toContain('Panels</span><strong>5</strong>');
    expect(markup).toContain('Frames</span><strong>3</strong>');
    expect(markup).toContain('Presets');
  });

  it('renders rail empty state and summary footer copy', () => {
    const markup = renderToStaticMarkup(
      <CalculatorInfillRail
        items={[]}
        selectedInfillId={null}
        uiById={new Map()}
        rafterSpacingM={0.9}
        summaryLine1="0 infills added"
        summaryLine2="Front 0 · Side 0 · Gable 0"
        summaryLine3={null}
        hasInfills={false}
        presets={presets}
        onAddCustom={noop}
        onAddPreset={noop}
        onSelectInfill={noop}
        onFocusPrimaryField={noop}
        onMoveInfill={noop}
        onRowRef={noop}
      />,
    );

    expect(markup).toContain('Ready to add infills');
    expect(markup).toContain('Use the buttons above to add your first infill');
    expect(markup).toContain('Front 0 · Side 0 · Gable 0');
  });

  it('renders selected, draft, auto-switched row chips and move button state', () => {
    const first = makeInfill({
      id: 'first',
      label: '',
      acrylicSource: 'sheet_panels',
      shape: { type: 'rect', widthM: '4.2', heightM: '2.1', bottomOffsetM: '0' },
    });
    const second = makeInfill({ id: 'second', label: 'Side screen', location: 'side' });
    const autoSwitchedEstimate = {
      ...estimateInfillUi(first, 0.9),
      acrylicSourceUsed: 'strip_620' as const,
      acrylicSourceAutoSwitched: true,
    };
    const uiById = new Map([
      [first.id, { status: 'draft' as const, estimate: autoSwitchedEstimate }],
      [second.id, { status: 'valid' as const, estimate: estimateInfillUi(second, 0.9) }],
    ]);

    const markup = renderToStaticMarkup(
      <CalculatorInfillRail
        items={[first, second]}
        selectedInfillId={first.id}
        uiById={uiById}
        rafterSpacingM={0.9}
        summaryLine1="2 infills added"
        summaryLine2="Front 1 · Side 1 · Gable 0"
        summaryLine3="System: Mixed systems · Panels: 7 · Frames: 4"
        hasInfills
        presets={presets}
        onAddCustom={noop}
        onAddPreset={noop}
        onSelectInfill={noop}
        onFocusPrimaryField={noop}
        onMoveInfill={noop}
        onRowRef={noop}
      />,
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Infill 1');
    expect(markup).toContain('Needs setup');
    expect(markup).toContain('Auto-switched');
    expect(markup).toContain('Move Infill 1 up');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Side screen');
  });
});
