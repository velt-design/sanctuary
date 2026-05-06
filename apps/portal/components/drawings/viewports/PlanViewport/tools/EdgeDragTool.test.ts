import { describe, expect, it, vi } from 'vitest';
import { createEdgeDragTool, type EdgeDragOutline } from './EdgeDragTool';

const RECT_OUTLINE: EdgeDragOutline = {
  id: 'house-footprint',
  family: 'house_forms',
  polygon: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 2000 },
    { x: 0, y: 2000 },
  ],
};

function basicEvent(overrides: Partial<{ x: number; y: number; button: number; pointerId: number }> = {}) {
  return {
    shape: null,
    point: { x: overrides.x ?? 0, y: overrides.y ?? 0 },
    button: overrides.button ?? 0,
    pointerId: overrides.pointerId ?? 1,
  };
}

describe('EdgeDragTool', () => {
  it('captures the closest edge on pointerdown when within tolerance', () => {
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onPreviewChange,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
    expect(onPreviewChange).toHaveBeenCalledTimes(1);
    const preview = onPreviewChange.mock.calls[0]![0];
    expect(preview.edgeIndex).toBe(1);
    expect(preview.deltaMm).toBe(0);
  });

  it('ignores pointerdown when the click is beyond the edge hit tolerance', () => {
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      edgeHitToleranceMm: 50,
      onPreviewChange,
    });
    tool.onPointerDown!(basicEvent({ x: 4200, y: 1000 }));
    expect(onPreviewChange).not.toHaveBeenCalled();
  });

  it('ignores non-primary buttons', () => {
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onPreviewChange,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000, button: 2 }));
    expect(onPreviewChange).not.toHaveBeenCalled();
  });

  it('does not start a session when there is no active outline', () => {
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => null,
      onPreviewChange,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
    expect(onPreviewChange).not.toHaveBeenCalled();
  });

  it('updates the preview polygon as the pointer moves perpendicular to the edge', () => {
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onPreviewChange,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
    tool.onPointerMove!(basicEvent({ x: 4500, y: 1000 }));
    const lastCall = onPreviewChange.mock.calls.at(-1)![0];
    expect(lastCall.deltaMm).toBeCloseTo(400);
    expect(lastCall.previewPolygon[1]).toEqual({ x: 4400, y: 0 });
    expect(lastCall.previewPolygon[2]).toEqual({ x: 4400, y: 2000 });
  });

  it('ignores pointermove for a different pointer id', () => {
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onPreviewChange,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000, pointerId: 1 }));
    onPreviewChange.mockClear();
    tool.onPointerMove!(basicEvent({ x: 4500, y: 1000, pointerId: 2 }));
    expect(onPreviewChange).not.toHaveBeenCalled();
  });

  it('commits the final polygon on pointerup when the delta is non-zero', () => {
    const onCommit = vi.fn();
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onPreviewChange,
      onCommit,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
    tool.onPointerMove!(basicEvent({ x: 4500, y: 1000 }));
    tool.onPointerUp!(basicEvent({ x: 4500, y: 1000 }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    const commit = onCommit.mock.calls[0]![0];
    expect(commit.outlineId).toBe('house-footprint');
    expect(commit.family).toBe('house_forms');
    expect(commit.nextPolygon[1]).toEqual({ x: 4400, y: 0 });
    expect(onPreviewChange).toHaveBeenLastCalledWith(null);
  });

  it('does not commit when the delta is zero (just a click without drag)', () => {
    const onCommit = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onCommit,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
    tool.onPointerUp!(basicEvent({ x: 4100, y: 1000 }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('clears the preview on cancel', () => {
    const onPreviewChange = vi.fn();
    const tool = createEdgeDragTool({
      getActiveOutline: () => RECT_OUTLINE,
      onPreviewChange,
    });
    tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
    onPreviewChange.mockClear();
    tool.onCancel!();
    expect(onPreviewChange).toHaveBeenCalledWith(null);
  });
});
