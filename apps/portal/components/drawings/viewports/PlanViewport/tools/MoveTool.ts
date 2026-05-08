import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  beginDrag,
  cancelDrag,
  commitDrag,
  exceedsDragThreshold,
  updateDrag,
  type DragSession,
  type PlanPoint,
} from '../interactions/dragLifecycle';
import { topProjectionShapeClassifier } from '@/components/drawings/viewports/selection/selectionRouter';
import type { Command } from '@/lib/drawings/commands/command';
import type { CommandBus } from '@/lib/drawings/commands/commandBus';
import type { Tool, ToolPointerEvent } from './Tool';

export type MoveTargetFamily = 'deck' | 'opening' | 'pergola';

export type MoveTarget = {
  family: MoveTargetFamily;
  targetId: string;
};

export type MoveRequest = {
  target: MoveTarget;
  delta: PlanPoint;
};

export type MoveToolPreview = {
  target: MoveTarget;
  delta: PlanPoint;
};

export type MoveToolConfig = {
  /**
   * Single predicate that decides whether a click should start a move.
   * Returns true when the host wants this target to be moved (e.g. it's
   * the active object and the family is supported). Returning false sends
   * the click through `onPointerDownFallthrough` to the next tool in the
   * chain. Replaces the older split between `acceptedFamilies` and
   * `getActiveTarget` -- both encoded the same conceptual decision and
   * forced callers to coordinate two filters; one predicate keeps the
   * intent in one place. See `docs/maintainability-principles.md` --
   * "single config option per concept."
   */
  canMoveTarget: (target: MoveTarget) => boolean;
  commandBus: CommandBus;
  dragThresholdMm: number;
  commitMove: (request: MoveRequest) => void;
  invertMove?: (request: MoveRequest) => void;
  onPreviewChange?: (preview: MoveToolPreview | null) => void;
  /**
   * Called when a pointer-down doesn't initiate a move (no shape under
   * cursor, or `canMoveTarget` returned false). Mirrors
   * `EdgeDragTool.onPointerDownFallthrough` so the host can chain tools
   * (EdgeDrag -> Move -> Select): each tool tries to claim the click; the
   * rejected event bubbles to the next tool.
   */
  onPointerDownFallthrough?: (event: ToolPointerEvent) => void;
};

export function moveTargetFromShape(shape: GeometryTopProjectionShape): MoveTarget | null {
  const target = topProjectionShapeClassifier(shape);
  if (target.kind === 'pergola') return { family: 'pergola', targetId: target.pergolaId };
  if (target.kind === 'workbench') {
    if (target.targetKind === 'deck') return { family: 'deck', targetId: target.targetId };
    if (target.targetKind === 'opening') return { family: 'opening', targetId: target.targetId };
  }
  return null;
}

export function createMoveCommand(input: {
  request: MoveRequest;
  commitMove: (request: MoveRequest) => void;
  invertMove?: (request: MoveRequest) => void;
}): Command {
  const inverseRequest: MoveRequest = {
    target: input.request.target,
    delta: { x: -input.request.delta.x, y: -input.request.delta.y },
  };
  const apply = input.commitMove;
  const invertApply = input.invertMove ?? input.commitMove;
  return {
    label: `Move ${input.request.target.family} ${input.request.target.targetId}`,
    apply: () => apply(input.request),
    invert: () =>
      createMoveCommand({
        request: inverseRequest,
        commitMove: invertApply,
        invertMove: apply,
      }),
  };
}

type DragContext = {
  target: MoveTarget;
  shape: GeometryTopProjectionShape;
};

export function createMoveTool(config: MoveToolConfig): Tool {
  let session: DragSession<DragContext> | null = null;

  const clearPreview = (): void => {
    config.onPreviewChange?.(null);
  };

  const publishPreview = (current: DragSession<DragContext>): void => {
    config.onPreviewChange?.({
      target: current.context.target,
      delta: { ...current.delta },
    });
  };

  return {
    id: 'move',
    cursor: 'move',
    onPointerDown(event: ToolPointerEvent) {
      // Non-primary buttons (right-click for pan, middle-click) never start
      // a move and never fall through — they bubble naturally to the SVG
      // root where `usePanZoom` handles them. Matches EdgeDragTool's pattern.
      if (event.button !== 0) return;
      if (!event.shape) {
        config.onPointerDownFallthrough?.(event);
        return;
      }
      const target = moveTargetFromShape(event.shape);
      if (!target || !config.canMoveTarget(target)) {
        config.onPointerDownFallthrough?.(event);
        return;
      }
      session = beginDrag({
        pointerId: event.pointerId,
        point: event.point,
        context: { target, shape: event.shape },
      });
      publishPreview(session);
    },
    onPointerMove(event: ToolPointerEvent) {
      if (!session || session.pointerId !== event.pointerId) return;
      session = updateDrag(session, event.point);
      publishPreview(session);
    },
    onPointerUp(event: ToolPointerEvent) {
      if (!session || session.pointerId !== event.pointerId) return;
      const finished = updateDrag(session, event.point);
      session = null;
      if (!exceedsDragThreshold(finished, config.dragThresholdMm)) {
        cancelDrag(finished);
        clearPreview();
        return;
      }
      const outcome = commitDrag(finished);
      const command = createMoveCommand({
        request: {
          target: outcome.session.context.target,
          delta: { ...outcome.session.delta },
        },
        commitMove: config.commitMove,
        invertMove: config.invertMove,
      });
      config.commandBus.apply(command);
      clearPreview();
    },
    onCancel() {
      if (!session) return;
      cancelDrag(session);
      session = null;
      clearPreview();
    },
  };
}
