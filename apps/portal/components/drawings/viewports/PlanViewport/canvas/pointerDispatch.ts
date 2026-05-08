import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { ToolPointerEvent } from '../tools/Tool';

export type PointerDispatchKind = 'down' | 'move' | 'up';

export type PointerDispatchInput = {
  kind: PointerDispatchKind;
  /**
   * Cursor world coord (metres) resolved from `clientPointToPlanProjection`,
   * or `null` when the SVG can't be measured. The helper NEVER invents a
   * coord on null -- see `docs/maintainability-principles.md` footgun #5.
   */
  point: PlanPoint | null;
  /** Hit-tested shape (down on hit-target) or null (down on empty / move / up). */
  shape: ToolPointerEvent['shape'];
  button: number;
  pointerId: number;
};

export type PointerDispatchAction =
  | { type: 'skip'; reason: 'null_point' }
  | {
      type: 'dispatch';
      kind: PointerDispatchKind;
      payload: ToolPointerEvent;
      /**
       * True when the caller should `setPointerCapture(pointerId)` on the
       * event's currentTarget BEFORE handing the payload to the tool
       * dispatcher. Without capture, the browser fires
       * `pointerleave`/`pointercancel` mid-drag as the cursor crosses
       * element boundaries -- see footgun #5.
       */
      capture: boolean;
    };

/**
 * Pure decision function: turns a raw pointer event (already resolved to a
 * world-coord point) into a tool-dispatcher action. Encodes the contract
 * documented in `docs/maintainability-principles.md` footgun #5:
 *
 *   1. null point => skip (never invent (0, 0)). Status: defense-in-depth.
 *      A previous version fell back to `point: { x: 0, y: 0 }` for events
 *      without a shape, which would have poisoned MoveTool's session if
 *      `clientPointToPlanProjection` ever returned null. In practice the
 *      `pointerCancel` fix (separate handler, see footgun #5) was the
 *      actual root cause of the deck-runaway bug; the null fallback wasn't
 *      observed firing. But the contract -- "ToolPointerEvent.point is
 *      always the true cursor world coord, never invented" -- is what the
 *      whole tool layer relies on, so the skip-on-null behaviour stays.
 *   2. valid point on 'down' => dispatch + capture. Capture prevents the
 *      browser from firing pointerleave/pointercancel when the cursor
 *      crosses element boundaries during a drag. LOAD-BEARING -- without
 *      this, real drags get cancelled and the active tool is torn down.
 *   3. valid point on 'move'/'up' => dispatch without capture (capture is
 *      already held from the down event; release happens automatically on
 *      pointerUp/pointerCancel at the browser layer).
 *
 * NOT handled here: pointerCancel events. They have different semantics
 * (cancel the active tool, never dispatch as up) and are routed through a
 * separate handler at the React layer. Sending a cancel event to this
 * function would dispatch it as a normal up -- exactly the bug that
 * produced the deck-runaway. See `PlanCanvas.handlePointerCancel`.
 *
 * Pure for testability. Side effects (SVG measurement, capture API call,
 * dispatcher invocation) live at the React boundary in `PlanCanvas.tsx`.
 */
export function buildPointerDispatchAction(input: PointerDispatchInput): PointerDispatchAction {
  if (!input.point) return { type: 'skip', reason: 'null_point' };
  const payload: ToolPointerEvent = {
    shape: input.shape,
    point: { x: input.point.x * 1000, y: input.point.y * 1000 },
    button: input.button,
    pointerId: input.pointerId,
  };
  return {
    type: 'dispatch',
    kind: input.kind,
    payload,
    capture: input.kind === 'down',
  };
}
