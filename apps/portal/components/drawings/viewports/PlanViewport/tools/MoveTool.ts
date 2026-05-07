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
  acceptedFamilies: ReadonlyArray<MoveTargetFamily>;
  commandBus: CommandBus;
  dragThresholdMm: number;
  commitMove: (request: MoveRequest) => void;
  invertMove?: (request: MoveRequest) => void;
  onPreviewChange?: (preview: MoveToolPreview | null) => void;
  /**
   * Called when a pointer-down doesn't initiate a move — either because there
   * is no shape under the cursor or the shape's family is not accepted.
   * Mirrors `EdgeDragTool.onPointerDownFallthrough` so the host can chain
   * tools (EdgeDrag -> Move -> Select): each tool tries to claim the click;
   * the rejected event bubbles to the next tool.
   */
  onPointerDownFallthrough?: (event: ToolPointerEvent) => void;
};

export function moveTargetFromShape(shape: GeometryTopProjectionShape): MoveTarget | null {
  const target = topProjectionShapeClassifier(shape);
  if (target.kind === 'pergola') return { family: 'pergola', targetId: target.pergolaId };
  if (target.kind === 'workbench') {
    // For decks, the canonical-outline shape is the `house_surface_solid`
    // prism (built by the geometry envelope), whose `sourceId` is the solid's
    // own id (`house-solid-deck-1`), not the deck's id (`deck-1`). The
    // builder copies the deck.id into `metadata.sourceId`. Prefer that when
    // present so the move handler resolves the right object in the project
    // model. The shorter `house_surface:deck-1` shape is also emitted but
    // is z-ordered below the solid, so the solid is what actually catches
    // pointerdowns.
    if (target.targetKind === 'deck') {
      const taggedSourceId =
        typeof shape.metadata?.sourceId === 'string' ? shape.metadata.sourceId : null;
      return { family: 'deck', targetId: taggedSourceId ?? target.targetId };
    }
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
  const accepted = new Set<MoveTargetFamily>(config.acceptedFamilies);
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
      if (!target || !accepted.has(target.family)) {
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
