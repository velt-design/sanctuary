import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import InfillPreview from './InfillPreview';

const support = {
  hasTop: true,
  hasBottom: true,
  hasLeft: true,
  hasRight: true,
  internalSupportMode: 'none' as const,
  internalSupportPositionsM: [],
};

const common = {
  status: 'valid' as const,
  orientationUsed: 'vertical' as const,
  panelCountEach: 1,
  unsupportedJoinerIndicesEach: [],
  supports: support,
  bayBoundariesM: [0, 2],
  bayWidthsM: [2],
  joinerLines: [],
  runSideM: 1,
  acrossSideM: 2,
  centreLimitM: 1.2,
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('InfillPreview canonical panels', () => {
  it('renders rectangle panel vertices supplied by the takeoff', () => {
    const { container, unmount } = renderIntoDocument(
      <InfillPreview
        {...common}
        shape={{ type: 'rect', widthM: '2', heightM: '1', bottomOffsetM: '0' }}
        panelPolygons={[{ id: 'panel-1', points: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }, { x_m: 1, y_m: 1 }, { x_m: 0, y_m: 1 }] }]}
      />,
    );

    expect(container.querySelector('polygon')?.getAttribute('points')).toBe('10.000,84.000 50.000,84.000 50.000,28.000 10.000,28.000');
    unmount();
  });

  it('renders sloping-top vertices supplied by the takeoff', () => {
    const { container, unmount } = renderIntoDocument(
      <InfillPreview
        {...common}
        runSideM={2}
        shape={{ type: 'mono_slope', widthM: '2', heightLowM: '1', heightHighM: '2', bottomOffsetM: '0' }}
        panelPolygons={[{ id: 'panel-slope', points: [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 0 }, { x_m: 2, y_m: 2 }, { x_m: 0, y_m: 1 }] }]}
      />,
    );

    expect(container.querySelector('polygon')?.getAttribute('points')).toBe('10.000,84.000 90.000,84.000 90.000,28.000 10.000,56.000');
    unmount();
  });
});
