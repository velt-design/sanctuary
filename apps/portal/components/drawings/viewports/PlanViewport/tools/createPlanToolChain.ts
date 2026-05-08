import type { Tool, ToolPointerEvent } from './Tool';

/**
 * Build the Plan viewport's composite tool: a single `Tool` that the
 * dispatcher routes events to, which internally delegates to
 * `EdgeDragTool` (entry) -> `MoveTool` -> `SelectTool` via fallthrough on
 * pointer-down, and fans pointer-move + pointer-up out to BOTH EdgeDrag
 * and Move so whichever tool started a session receives its updates.
 *
 * Why this exists: the dispatcher routes events to a single active tool.
 * EdgeDragTool's `onPointerDownFallthrough` chains MoveTool on a missed
 * edge click, but the dispatcher still routes pointer-move to EdgeDragTool
 * — so a move started via fallthrough would never see its updates and
 * never commit. The composite tool fixes that by forwarding move/up to
 * both child tools; each tool guards on its own session state, so only
 * the one with an active drag actually acts on these events.
 *
 * SelectTool is reached via the chain entry tool's
 * `onPointerDownFallthrough` (constructed by the caller); it has no
 * pointer-move/up handlers, so it doesn't need to participate in the
 * fan-out.
 *
 * Stable id ('plan-tools') so `ToolDispatcher` doesn't cancel an active
 * session when the cursor changes mid-render.
 *
 * See `docs/maintainability-principles.md` -- "shared logic for shared
 * operations" and "integration tests at boundaries." This module is the
 * boundary; it is tested end-to-end without React in
 * `createPlanToolChain.test.ts`.
 */
export function createPlanToolChain(input: {
  /** Entry tool for pointer-down. Should fall through to `moveTool`. */
  edgeDragTool: Tool;
  /** Move tool. Receives fallthrough from `edgeDragTool` on missed edges. */
  moveTool: Tool;
  /** Cursor to publish on the composite tool. */
  cursor?: string;
}): Tool {
  const { edgeDragTool, moveTool, cursor = 'default' } = input;
  return {
    id: 'plan-tools',
    cursor,
    onPointerDown: (event: ToolPointerEvent) => edgeDragTool.onPointerDown?.(event),
    onPointerMove: (event: ToolPointerEvent) => {
      edgeDragTool.onPointerMove?.(event);
      moveTool.onPointerMove?.(event);
    },
    onPointerUp: (event: ToolPointerEvent) => {
      edgeDragTool.onPointerUp?.(event);
      moveTool.onPointerUp?.(event);
    },
    onCancel: () => {
      edgeDragTool.onCancel?.();
      moveTool.onCancel?.();
    },
  };
}
