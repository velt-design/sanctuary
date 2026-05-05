import { describe, expect, it, vi } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { createSelectTool } from './SelectTool';
import type { ToolPointerEvent } from './Tool';

function shape(overrides: Partial<GeometryTopProjectionShape> = {}): GeometryTopProjectionShape {
  return {
    id: 'shape-1',
    sourceObjectId: 'shape-1',
    sourceId: null,
    sourceType: 'house_surface',
    family: 'house',
    kind: 'deck',
    polygon: [],
    zOrder: 0,
    zMin: null,
    zMax: null,
    ...overrides,
  };
}

function leftClick(over: GeometryTopProjectionShape | null): ToolPointerEvent {
  return {
    shape: over,
    point: { x: 0, y: 0 },
    button: 0,
    pointerId: 1,
  };
}

describe('createSelectTool', () => {
  it('dispatches workbench-target selection for a left-click on a deck shape', () => {
    const callbacks = {
      onSelectObjectWorkbenchTarget: vi.fn(),
      onSelectPergolaTarget: vi.fn(),
      onClearWorkbenchSelection: vi.fn(),
    };
    const tool = createSelectTool(callbacks);
    tool.onPointerDown?.(
      leftClick(shape({ family: 'house', kind: 'deck', sourceObjectId: 'deck-1' })),
    );

    expect(callbacks.onSelectObjectWorkbenchTarget).toHaveBeenCalledWith({
      kind: 'deck',
      targetId: 'deck-1',
    });
    expect(callbacks.onClearWorkbenchSelection).not.toHaveBeenCalled();
  });

  it('clears selection on a left-click of empty canvas', () => {
    const callbacks = {
      onSelectObjectWorkbenchTarget: vi.fn(),
      onSelectPergolaTarget: vi.fn(),
      onClearWorkbenchSelection: vi.fn(),
    };
    const tool = createSelectTool(callbacks);
    tool.onPointerDown?.(leftClick(null));
    expect(callbacks.onClearWorkbenchSelection).toHaveBeenCalledTimes(1);
  });

  it('ignores non-left-button pointer-down events', () => {
    const callbacks = {
      onSelectObjectWorkbenchTarget: vi.fn(),
      onSelectPergolaTarget: vi.fn(),
      onClearWorkbenchSelection: vi.fn(),
    };
    const tool = createSelectTool(callbacks);
    tool.onPointerDown?.({
      shape: shape({ family: 'house', kind: 'deck', sourceObjectId: 'deck-1' }),
      point: { x: 0, y: 0 },
      button: 2,
      pointerId: 1,
    });

    expect(callbacks.onSelectObjectWorkbenchTarget).not.toHaveBeenCalled();
    expect(callbacks.onClearWorkbenchSelection).not.toHaveBeenCalled();
  });
});
