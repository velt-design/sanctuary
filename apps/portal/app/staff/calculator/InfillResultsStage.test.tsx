import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import InfillResultsStage from './InfillResultsStage';
import type { CutListRow, InfillWarningItem } from './infillCompute';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const rows: CutListRow[] = [
  {
    group: 'piece',
    pieceType: 'panel',
    role: 'rectangle',
    part: 'Acrylic panel 1',
    qty: 1,
    lengthM: 2.1,
    finishedWidthM: 1.2,
    finishedHeightM: 2.1,
    pieceId: 'panel-1',
    sourceInfillId: 'infill-1',
  },
  {
    group: 'purchase',
    pieceType: 'stock',
    role: 'acrylic_sheet',
    part: 'Plexi sheet 3050 x 2030',
    qty: 1,
    lengthM: 3.05,
    finishedWidthM: 2.03,
    pieceId: 'sheet-1',
    sourceInfillId: 'infill-1',
  },
];

function commonProps() {
  return {
    status: { tone: 'ready' as const, title: 'Ready', message: 'Ready to manufacture.' },
    blockers: [],
    materialLabel: 'Sheet panels',
    orientationLabel: 'Vertical',
    additionalSupportCount: 1,
    additionalSupportSummary: '1 additional 50x50 support is included in the purchase plan.',
    cutListStatus: 'valid' as const,
    cutListRows: rows,
    preview: <div>Canonical preview</div>,
    technicalDetails: <div>Technical comparison</div>,
    technicalDetailsOpen: false,
    onTechnicalDetailsToggle: vi.fn(),
    onFixBlocker: vi.fn(),
  };
}

describe('InfillResultsStage', () => {
  it('presents production records before the diagram and collapsed technical details', () => {
    const { unmount } = renderIntoDocument(<InfillResultsStage {...commonProps()} />);
    const summary = document.querySelector('[aria-label="Computed infill summary"]');
    if (!(summary instanceof HTMLElement)) throw new Error('Missing computed infill summary.');
    const content = summary.textContent ?? '';

    expect(content.indexOf('Panel material')).toBeLessThan(content.indexOf('Pieces to cut'));
    expect(content.indexOf('Pieces to cut')).toBeLessThan(content.indexOf('Materials to purchase'));
    expect(content.indexOf('Materials to purchase')).toBeLessThan(content.indexOf('Cutting diagram'));
    expect(content.indexOf('Cutting diagram')).toBeLessThan(content.indexOf('Cost and technical details'));
    expect(document.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(content).toContain('Acrylic panel 1');
    expect(content).toContain('Plexi sheet 3050 x 2030');
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Download CSV'))).toBe(true);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Copy CSV'))).toBe(true);

    unmount();
  });

  it('renders blockers, routes their action, and withholds CSV for a blocked result', () => {
    const blocker: InfillWarningItem = {
      id: 'stock-blocker',
      severity: 'error',
      message: 'This panel cannot fit available stock.',
      target: { section: 'basic', fieldKey: 'acrylic' },
    };
    const onFixBlocker = vi.fn();
    const { unmount } = renderIntoDocument(
      <InfillResultsStage
        {...commonProps()}
        status={{ tone: 'blocked', title: 'Cannot manufacture', message: blocker.message }}
        blockers={[blocker]}
        cutListStatus="draft"
        cutListRows={[]}
        onFixBlocker={onFixBlocker}
      />,
    );

    expect(document.querySelector('[role="status"]')?.textContent).toContain('Cannot manufacture');
    const fixButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Fix details'));
    if (!(fixButton instanceof HTMLButtonElement)) throw new Error('Missing blocker action.');
    act(() => fixButton.click());
    expect(onFixBlocker).toHaveBeenCalledWith(blocker);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Download CSV'))).toBe(false);
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Copy CSV'))).toBe(false);

    unmount();
  });
});
