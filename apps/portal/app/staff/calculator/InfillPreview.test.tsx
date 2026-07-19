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
  acrossSideM: 2,
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
        shape={{ type: 'mono_slope', widthM: '2', heightLowM: '1', heightHighM: '2', bottomOffsetM: '0' }}
        panelPolygons={[{ id: 'panel-slope', points: [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 0 }, { x_m: 2, y_m: 2 }, { x_m: 0, y_m: 1 }] }]}
      />,
    );

    expect(container.querySelector('polygon')?.getAttribute('points')).toBe('10.000,84.000 90.000,84.000 90.000,28.000 10.000,56.000');
    unmount();
  });

  it('renders a true triangle without a zero-length edge or support marker', () => {
    const { container, unmount } = renderIntoDocument(
      <InfillPreview
        {...common}
        mode="supports"
        shape={{ type: 'mono_slope', widthM: '2', heightLowM: '0', heightHighM: '1.5', bottomOffsetM: '0' }}
        panelPolygons={[{ id: 'panel-triangle', points: [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 0 }, { x_m: 2, y_m: 1.5 }] }]}
      />,
    );

    expect(container.querySelector('polygon')?.getAttribute('points')).toBe('10.000,84.000 90.000,84.000 90.000,28.000');
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toContain('left point');
    expect(container.querySelectorAll('svg > line')).toHaveLength(3);
    expect(container.querySelectorAll('svg > circle')).toHaveLength(3);
    expect(container.textContent).toContain('Point');
    expect(container.textContent).toContain('Right');
    expect(container.textContent).not.toContain('Left');

    unmount();
  });

  it('labels every edge and explains support marks in support mode', () => {
    const { container, unmount } = renderIntoDocument(
      <InfillPreview
        {...common}
        mode="supports"
        supports={{ ...support, hasBottom: false }}
        shape={{ type: 'rect', widthM: '2', heightM: '1', bottomOffsetM: '0' }}
        panelPolygons={[]}
      />,
    );

    expect(container.querySelector('svg')?.getAttribute('aria-label')).toContain('labelled top, bottom, left and right');
    expect(container.textContent).toContain('Top');
    expect(container.textContent).toContain('Bottom');
    expect(container.textContent).toContain('Existing fixing member');
    expect(container.textContent).toContain('New support included');
    expect(container.textContent).not.toContain('run ');

    unmount();
  });

  it('keeps the Opening preview neutral and free of support or cutting-plan marks', () => {
    const { container, unmount } = renderIntoDocument(
      <InfillPreview
        {...common}
        mode="opening"
        supports={{ ...support, hasBottom: false }}
        shape={{ type: 'rect', widthM: '2', heightM: '1', bottomOffsetM: '0' }}
        panelPolygons={[{ id: 'panel-1', points: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }, { x_m: 1, y_m: 1 }, { x_m: 0, y_m: 1 }] }]}
        joinerLines={[{ positionM: 1, supported: false }]}
        unsupportedJoinerIndicesEach={[1]}
      />,
    );

    expect(container.querySelectorAll('svg > polygon')).toHaveLength(1);
    expect(container.querySelectorAll('svg > line')).toHaveLength(0);
    expect(container.querySelectorAll('svg > circle')).toHaveLength(0);
    expect(container.textContent).toContain('Finished opening');
    expect(container.textContent).not.toContain('Cutting layout');
    expect(container.textContent).not.toContain('New support included');

    unmount();
  });
});
