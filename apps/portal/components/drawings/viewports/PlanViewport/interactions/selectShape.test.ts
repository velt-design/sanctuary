import { describe, expect, it, vi } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  dispatchSelectionTarget,
  selectShape,
  type ShapeSelectionCallbacks,
} from './selectShape';

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
    onToggleHouseTerminalEnd: vi.fn(),
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

  it('dispatches a project-level pergola reference by source object id', () => {
    const callbacks = spies();
    selectShape(
      shape({
        id: 'pergola_reference:pergola-2',
        sourceObjectId: 'pergola-2',
        sourceType: 'pergola_reference',
        family: 'pergola',
        kind: 'outline',
      }),
      callbacks,
    );
    expect(callbacks.onSelectPergolaTarget).toHaveBeenCalledWith('pergola-2');
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
    expect(callbacks.onToggleHouseTerminalEnd).not.toHaveBeenCalled();
  });

  it('routes house_terminal_end_toggle to onToggleHouseTerminalEnd with the resolved endId and isOpen', () => {
    const callbacks = spies();
    dispatchSelectionTarget(
      {
        kind: 'house_terminal_end_toggle',
        houseFormId: 'house-form-2',
        endId: 'house-gable-end-x-2',
        isOpen: true,
      },
      callbacks,
    );
    expect(callbacks.onToggleHouseTerminalEnd).toHaveBeenCalledTimes(1);
    expect(callbacks.onToggleHouseTerminalEnd).toHaveBeenCalledWith({
      houseFormId: 'house-form-2',
      endId: 'house-gable-end-x-2',
      currentlyOpen: true,
    });
    // The toggle action does NOT clear the selection or fire any of the
    // selection-style callbacks -- mutating selection on every click on a
    // hip end would be jarring (the user is editing the roof, not
    // navigating).
    expect(callbacks.onSelectObjectWorkbenchTarget).not.toHaveBeenCalled();
    expect(callbacks.onClearWorkbenchSelection).not.toHaveBeenCalled();
  });
});

describe('selectShape end-to-end for terminal-end roof facets', () => {
  it('routes a hip facet (kind=roof) with openGableEndId metadata to the toggle callback', () => {
    // Milestone 13: the actual hip facet's roof shape is enriched
    // with `openGableEndId` + `isOpen` metadata at top-projection
    // build time. The selection router recognises that and dispatches
    // the toggle instead of the regular workbench-roof selection.
    const callbacks = spies();
    selectShape(
      shape({
        family: 'house',
        kind: 'roof',
        sourceObjectId: 'house-roof-edge-2',
        metadata: {
          houseFormId: 'house-form-2',
          openGableEndId: 'house-gable-end-x-2',
          isOpen: false,
        },
      }),
      callbacks,
    );
    expect(callbacks.onToggleHouseTerminalEnd).toHaveBeenCalledWith({
      houseFormId: 'house-form-2',
      endId: 'house-gable-end-x-2',
      currentlyOpen: false,
    });
    expect(callbacks.onSelectObjectWorkbenchTarget).not.toHaveBeenCalled();
  });

  it('still routes a non-terminal-end roof facet to the workbench roof selection', () => {
    const callbacks = spies();
    selectShape(
      shape({
        family: 'house',
        kind: 'roof',
        sourceObjectId: 'house-roof-min-y',
      }),
      callbacks,
    );
    expect(callbacks.onSelectObjectWorkbenchTarget).toHaveBeenCalledWith({
      kind: 'roof',
      targetId: 'house-roof-min-y',
    });
    expect(callbacks.onToggleHouseTerminalEnd).not.toHaveBeenCalled();
  });
});
