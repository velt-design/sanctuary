import type { GeometryTopProjectionShape, Point2 } from '@sp/geometry';
import {
  beginDrag,
  cancelDrag,
  commitDrag,
  exceedsDragThreshold,
  updateDrag,
  type DragSession,
  type PlanPoint,
} from '../interactions/dragLifecycle';
import type { SnapLineTarget } from '../interactions/snap/snapEngine';
import { topProjectionShapeClassifier } from '@/components/drawings/viewports/selection/selectionRouter';
import type { Command } from '@/lib/drawings/commands/command';
import type { CommandBus } from '@/lib/drawings/commands/commandBus';
import { resolveMoveSnap, type MoveSnapResult } from './resolveMoveSnap';
import type { Tool, ToolPointerEvent } from './Tool';

export type MoveTargetFamily = 'deck' | 'opening' | 'pergola' | 'house_form';

export type MoveTarget = {
  family: MoveTargetFamily;
  targetId: string;
};

export type MoveRequest = {
  target: MoveTarget;
  delta: PlanPoint;
  /**
   * Snap result when the drag ended on a snap. Surfaces the same
   * `EdgeSnapResult` shape `EdgeDragTool` produces, but for the moving
   * polygon's best-matching edge -- the host can derive an attachment
   * (e.g. deck snapped to wall) from the snap target the same way it
   * does for a resize. `null` when no snap held at release.
   */
  snap: MoveSnapResult | null;
};

export type MoveToolPreview = {
  target: MoveTarget;
  delta: PlanPoint;
  /**
   * Live snap state during drag. PlanSnapIndicatorLayer renders the
   * indicator on the snapped target line; consumers that don't render
   * snap visuals can ignore. `null` when no snap is currently active.
   */
  snap: MoveSnapResult | null;
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
   * Snap line target source -- typically the same one the EdgeDragTool
   * consumes (`buildHouseSnapTargets` + other-pergola outline edges). Read
   * fresh on every pointermove so re-solves between pointer events
   * surface up-to-date targets. Pre-filtered by family at the host (decks
   * skip roof eaves; pergolas keep them) -- the tool itself does not
   * filter. Omit (or return empty) for "no snap"; the move tool falls
   * back to the natural translation delta.
   */
  getSnapLineTargets?: () => ReadonlyArray<SnapLineTarget>;
  /**
   * Returns the polygon (world mm) of the object currently being moved,
   * if any. Used to project translation onto each edge's outward normal
   * for snap resolution. Without it, the move tool can't compute snap and
   * just emits the natural delta. Same provider as `EdgeDragTool`'s
   * `getActiveOutline.polygon` — keep them in sync at the host.
   */
  getActiveMovePolygon?: () => ReadonlyArray<Point2> | null;
  /** Max snap correction distance (mm) before a candidate is rejected. Default: matches `resolveEdgeSnap`. */
  snapToleranceMm?: number;
  /** Max angle (degrees) between the polygon's edge and a parallel target. Default: matches `resolveEdgeSnap`. */
  snapAngularToleranceDeg?: number;
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
    // PR11: house footprints (the `house_reference` shapes PR8c-iii emits
    // for every form) become movable too -- drag updates the form's
    // `transform.offsetXM/Y`. The host predicate (`canMoveTarget`)
    // gates which forms accept moves; today only additional forms move
    // (primary stays anchored to the calculator snapshot's frame).
    if (target.targetKind === 'footprint') return { family: 'house_form', targetId: target.targetId };
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
    // Inverse move never carries a snap result -- the snap was a hint
    // for the forward attachment write; reverting puts the object back
    // wherever it was, no host needed to consult a snap target.
    snap: null,
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
  /**
   * Polygon at drag-start (world mm). Captured once on pointer-down so
   * the snap math sees a stable shape -- if we re-read on every move the
   * polygon would be the *previewed* (already snap-adjusted) one and
   * snap convergence would oscillate. `null` means snap was not
   * available at start (no polygon provider, no active outline) -- the
   * move proceeds with no snap correction.
   */
  startPolygon: ReadonlyArray<Point2> | null;
};

export function createMoveTool(config: MoveToolConfig): Tool {
  let session: DragSession<DragContext> | null = null;

  const clearPreview = (): void => {
    config.onPreviewChange?.(null);
  };

  /**
   * Resolve a snap from the current drag's natural delta against the
   * captured start polygon and the host-supplied snap targets. Returns
   * `{ adjustedDelta, snap }` where `snap` is `null` if no snap was
   * found -- in that case `adjustedDelta` equals the natural delta.
   * Centralised here so preview + commit produce the same numbers.
   */
  const resolveSnapForSession = (
    current: DragSession<DragContext>,
  ): { adjustedDelta: PlanPoint; snap: MoveSnapResult | null } => {
    const startPolygon = current.context.startPolygon;
    if (!startPolygon || startPolygon.length < 3) {
      return { adjustedDelta: { ...current.delta }, snap: null };
    }
    const lineTargets = config.getSnapLineTargets?.() ?? [];
    if (lineTargets.length === 0) {
      return { adjustedDelta: { ...current.delta }, snap: null };
    }
    const snap = resolveMoveSnap({
      originalPolygon: startPolygon,
      naturalDeltaMm: { x: current.delta.x, y: current.delta.y },
      lineTargets,
      toleranceMm: config.snapToleranceMm,
      angularToleranceDeg: config.snapAngularToleranceDeg,
    });
    if (!snap) return { adjustedDelta: { ...current.delta }, snap: null };
    return {
      adjustedDelta: { x: snap.adjustedDeltaMm.x, y: snap.adjustedDeltaMm.y },
      snap,
    };
  };

  const publishPreview = (current: DragSession<DragContext>): void => {
    const { adjustedDelta, snap } = resolveSnapForSession(current);
    config.onPreviewChange?.({
      target: current.context.target,
      delta: adjustedDelta,
      snap,
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
      const startPolygon = config.getActiveMovePolygon?.() ?? null;
      session = beginDrag({
        pointerId: event.pointerId,
        point: event.point,
        context: { target, shape: event.shape, startPolygon },
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
      // Resolve snap one more time at release so the committed delta
      // matches what the preview was showing on the last frame.
      const { adjustedDelta, snap } = resolveSnapForSession(outcome.session);
      const command = createMoveCommand({
        request: {
          target: outcome.session.context.target,
          delta: adjustedDelta,
          snap,
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
