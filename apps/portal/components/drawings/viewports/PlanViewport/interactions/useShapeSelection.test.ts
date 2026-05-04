import { describe, expect, it, vi } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  dispatchSelectionTarget,
  selectShape,
  type ShapeSelectionCallbacks,
} from './useShapeSelection';

function shape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'shape-1',
    sourceObjectId: 'shape-1',
    sourceId: null,
    sourceType: 'house_surface',
    family: 'house',
    kind: 'footprint',
    polygon: [],
    zOrder: 0,
    zMin: null,
    zMax: null,
    ...overrides,
  };
}

function spies(): Required<ShapeSelectionCallbacks> {
  return {
    onSelectObjectWorkbenchTarget: vi.fn(),
    onSelectPergolaTarget: vi.fn(),
    onClearWorkbenchSelection: vi.fn(),
  };
}

describe('selectShape', () => {
  it('dispatches a workbench deck target for a house/deck shape', () => {
    const callbacks = spies();
    selectShape(
      shape({ family: 'house', kind: 'deck', sourceObjectId: 'deck-1' }),
      callbacks,
    );
    expect(callbacks.onSelectObjectWorkbenchTarget).toHaveBeenCalledWith({
      kind: 'deck',
      targetId: 'deck-1',
    });
    expect(callbacks.onSelectPergolaTarget).not.toHaveBeenCalled();
    expect(callbacks.onClearWorkbenchSelection).not.toHaveBeenCalled();
  });

  it('dispatches onSelectPergolaTarget for a pergola shape', () => {
    const callbacks = spies();
    selectShape(
      shape({
        family: 'pergola',
        kind: 'roof_plane',
        sourceObjectId: 'rendered-1',
        metadata: { pergolaId: 'pergola-A' },
      }),
      callbacks,
    );
    expect(callbacks.onSelectPergolaTarget).toHaveBeenCalledWith('pergola-A');
    expect(callbacks.onSelectObjectWorkbenchTarget).not.toHaveBeenCalled();
  });

  it('dispatches the workbench opening kind for opening_marker and opening_outline', () => {
    const callbacks = spies();
    selectShape(
      shape({ family: 'house', kind: 'opening_marker', sourceObjectId: 'opening-2' }),
      callbacks,
    );
    selectShape(
      shape({ family: 'house', kind: 'opening_outline', sourceObjectId: 'opening-2' }),
      callbacks,
    );
    expect(callbacks.onSelectObjectWorkbenchTarget).toHaveBeenCalledTimes(2);
    expect(callbacks.onSelectObjectWorkbenchTarget).toHaveBeenLastCalledWith({
      kind: 'opening',
      targetId: 'opening-2',
    });
  });

  it('skips dispatch entirely for an unhandled (reference) shape', () => {
    const callbacks = spies();
    selectShape(shape({ family: 'reference', kind: 'roof_outline' }), callbacks);
    expect(callbacks.onSelectObjectWorkbenchTarget).not.toHaveBeenCalled();
    expect(callbacks.onSelectPergolaTarget).not.toHaveBeenCalled();
    expect(callbacks.onClearWorkbenchSelection).not.toHaveBeenCalled();
  });

  it('does not throw when callbacks are undefined', () => {
    expect(() => {
      selectShape(shape({ family: 'house', kind: 'deck', sourceObjectId: 'deck-1' }), {});
    }).not.toThrow();
  });
});

describe('dispatchSelectionTarget', () => {
  it('routes the none kind to onClearWorkbenchSelection', () => {
    const callbacks = spies();
    dispatchSelectionTarget({ kind: 'none' }, callbacks);
    expect(callbacks.onClearWorkbenchSelection).toHaveBeenCalledTimes(1);
  });

  it('does not invoke any callback for the unhandled kind', () => {
    const callbacks = spies();
    dispatchSelectionTarget({ kind: 'unhandled', objectId: 'mystery-1' }, callbacks);
    expect(callbacks.onSelectObjectWorkbenchTarget).not.toHaveBeenCalled();
    expect(callbacks.onSelectPergolaTarget).not.toHaveBeenCalled();
    expect(callbacks.onClearWorkbenchSelection).not.toHaveBeenCalled();
  });
});
