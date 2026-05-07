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

  describe('snap line targets', () => {
    // Step 7b: snap parallel line targets (roof eaves, walls) override the
    // natural drag delta when the dragged edge would land within tolerance.
    // The preview's `snap` field surfaces the resolved candidate; the commit
    // carries it forward so downstream attachment derivation can read it.

    const eaveTarget = {
      id: 'roof-eave-1',
      sourceObjectId: 'house-main',
      edgeKind: 'roof_eave',
      // Horizontal eave at y=2500 — parallel to the rect's top/bottom edges,
      // 500mm beyond y=2000 (the top edge of RECT_OUTLINE).
      start: { x: 0, y: 2500 },
      end: { x: 4000, y: 2500 },
    };

    it('snaps the preview delta to a parallel line target within tolerance', () => {
      const onPreviewChange = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        getSnapLineTargets: () => [eaveTarget],
        snapToleranceMm: 250,
        onPreviewChange,
      });
      // Grab top edge (index 2 in the rect's CCW polygon — y=2000 edge).
      tool.onPointerDown!(basicEvent({ x: 2000, y: 2100 }));
      // Drag outward (in +y direction, the outward normal of the top edge)
      // to delta ≈ 450 — within 250mm of the eave at delta=500.
      tool.onPointerMove!(basicEvent({ x: 2000, y: 2550 }));
      const lastCall = onPreviewChange.mock.calls.at(-1)![0];
      expect(lastCall.snap).not.toBeNull();
      expect(lastCall.snap.target.edgeKind).toBe('roof_eave');
      expect(lastCall.snap.snapDeltaMm).toBeCloseTo(500, 6);
      // Preview polygon's top edge should land exactly on the eave (y=2500).
      expect(lastCall.previewPolygon[2]).toEqual({ x: 4000, y: 2500 });
      expect(lastCall.previewPolygon[3]).toEqual({ x: 0, y: 2500 });
      expect(lastCall.deltaMm).toBeCloseTo(500, 6);
    });

    it('leaves preview unchanged when no line target is in range', () => {
      const onPreviewChange = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        getSnapLineTargets: () => [eaveTarget],
        snapToleranceMm: 100,
        onPreviewChange,
      });
      tool.onPointerDown!(basicEvent({ x: 2000, y: 2100 }));
      // Drag to delta=200 — far from eave (500), beyond 100mm tolerance.
      tool.onPointerMove!(basicEvent({ x: 2000, y: 2300 }));
      const lastCall = onPreviewChange.mock.calls.at(-1)![0];
      expect(lastCall.snap).toBeNull();
      expect(lastCall.deltaMm).toBeCloseTo(200, 6);
    });

    it('drops snap when the drag moves out of tolerance after entering it', () => {
      // Soft-snap behavior: snap holds while undisturbed but breaks freely on
      // continued drag.
      const onPreviewChange = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        getSnapLineTargets: () => [eaveTarget],
        snapToleranceMm: 100,
        onPreviewChange,
      });
      tool.onPointerDown!(basicEvent({ x: 2000, y: 2100 }));
      // First move — within tolerance, snaps.
      tool.onPointerMove!(basicEvent({ x: 2000, y: 2550 }));
      expect(onPreviewChange.mock.calls.at(-1)![0].snap).not.toBeNull();
      // Second move — way past, breaks snap.
      tool.onPointerMove!(basicEvent({ x: 2000, y: 5000 }));
      expect(onPreviewChange.mock.calls.at(-1)![0].snap).toBeNull();
    });

    it('forwards the resolved snap on commit so the host can derive attachment kind', () => {
      const onCommit = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        getSnapLineTargets: () => [eaveTarget],
        snapToleranceMm: 250,
        onCommit,
      });
      tool.onPointerDown!(basicEvent({ x: 2000, y: 2100 }));
      tool.onPointerMove!(basicEvent({ x: 2000, y: 2550 }));
      tool.onPointerUp!(basicEvent({ x: 2000, y: 2550 }));
      const commit = onCommit.mock.calls[0]![0];
      expect(commit.snap).not.toBeNull();
      expect(commit.snap.target.id).toBe('roof-eave-1');
      expect(commit.snap.target.edgeKind).toBe('roof_eave');
      // Commit polygon includes the snap correction, not the natural delta.
      expect(commit.nextPolygon[2]).toEqual({ x: 4000, y: 2500 });
    });

    it('falls back to natural delta when no snap targets are configured', () => {
      const onCommit = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        // getSnapLineTargets omitted — house/deck edits without snap config.
        onCommit,
      });
      tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
      tool.onPointerMove!(basicEvent({ x: 4500, y: 1000 }));
      tool.onPointerUp!(basicEvent({ x: 4500, y: 1000 }));
      expect(onCommit).toHaveBeenCalledTimes(1);
      const commit = onCommit.mock.calls[0]![0];
      expect(commit.snap).toBeNull();
      expect(commit.nextPolygon[1]).toEqual({ x: 4400, y: 0 });
    });

    it('rejects perpendicular line targets even when in distance range', () => {
      // A vertical line target near the top edge — perpendicular to the
      // horizontal edge being dragged. Snap engine angular tolerance must
      // filter this out.
      const verticalLine = {
        id: 'wall-vertical',
        sourceObjectId: 'house-main',
        edgeKind: 'wall',
        start: { x: 4500, y: 0 },
        end: { x: 4500, y: 4000 },
      };
      const onPreviewChange = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        getSnapLineTargets: () => [verticalLine],
        snapToleranceMm: 1000,
        onPreviewChange,
      });
      tool.onPointerDown!(basicEvent({ x: 2000, y: 2100 }));
      tool.onPointerMove!(basicEvent({ x: 2000, y: 2400 }));
      const lastCall = onPreviewChange.mock.calls.at(-1)![0];
      expect(lastCall.snap).toBeNull();
    });
  });

  describe('onPointerDownFallthrough', () => {
    it('fires when there is no active outline', () => {
      const onPointerDownFallthrough = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => null,
        onPointerDownFallthrough,
      });
      const event = basicEvent({ x: 100, y: 100 });
      tool.onPointerDown!(event);
      expect(onPointerDownFallthrough).toHaveBeenCalledWith(event);
    });

    it('fires when the click is beyond the edge hit tolerance', () => {
      const onPointerDownFallthrough = vi.fn();
      const onPreviewChange = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        edgeHitToleranceMm: 50,
        onPreviewChange,
        onPointerDownFallthrough,
      });
      const event = basicEvent({ x: 4200, y: 1000 });
      tool.onPointerDown!(event);
      expect(onPreviewChange).not.toHaveBeenCalled();
      expect(onPointerDownFallthrough).toHaveBeenCalledWith(event);
    });

    it('does NOT fire when the click is within tolerance and the drag starts', () => {
      const onPointerDownFallthrough = vi.fn();
      const tool = createEdgeDragTool({
        getActiveOutline: () => RECT_OUTLINE,
        onPointerDownFallthrough,
      });
      tool.onPointerDown!(basicEvent({ x: 4100, y: 1000 }));
      expect(onPointerDownFallthrough).not.toHaveBeenCalled();
    });
  });
});
