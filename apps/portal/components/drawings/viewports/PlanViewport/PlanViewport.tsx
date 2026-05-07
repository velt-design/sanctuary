'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import { createCommandBus } from '@/lib/drawings/commands/commandBus';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import type {
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import { PlanCanvas } from './canvas/PlanCanvas';
import { usePlanRenderModel } from './canvas/usePlanRenderModel';
import { usePlanSelectionDimensions } from './canvas/usePlanSelectionDimensions';
import { pickPrimaryEditCandidate, type ActiveObjectFamily, type PlanDimension } from './canvas/planDimension';
import { ToolDispatcherProvider } from './tools/ToolDispatcher';
import { createSelectTool } from './tools/SelectTool';
import { createEdgeDragTool, type EdgeDragCommit, type EdgeDragHover, type EdgeDragPreview } from './tools/EdgeDragTool';
import { createMoveTool, type MoveRequest } from './tools/MoveTool';
import type { Tool } from './tools/Tool';
import { buildHouseSnapTargets } from './interactions/snap/buildHouseSnapTargets';
import { buildOtherPergolaSnapTargets } from './interactions/snap/buildOtherPergolaSnapTargets';
import type { SnapLineTarget } from './interactions/snap/snapEngine';

export type { EdgeDragCommit, EdgeDragHover, EdgeDragPreview } from './tools/EdgeDragTool';
export type { MoveRequest } from './tools/MoveTool';
import { PlanViewportPlaceholder } from './PlanViewportPlaceholder';
import lineweightStyles from './canvas/planLineweights.module.css';

export type { PlanDimension } from './canvas/planDimension';

const DEFAULT_VISIBILITY: DrawingWorkbenchVisibilityState = {
  house: true,
  pergolas: true,
  decks: true,
  openings: true,
};

export type PlanViewportProps = {
  artifact: WorkbenchSolvedGeometryArtifact | null;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  activeObjectRef?: WorkbenchObjectRef | null;
  dimensions?: ReadonlyArray<PlanDimension>;
  /**
   * Faded outlines for OTHER pergolas in the project (Step 5d). Filtered
   * upstream to drop the active pergola's own outline + the house ref so
   * the overlay only adds shapes the active artifact doesn't already
   * render. Empty for single-pergola projects.
   */
  projectContextShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  onCommitOutlineEdit?: (commit: EdgeDragCommit) => void;
  /**
   * Called when the move tool commits a translate. The handler reads the
   * target's current `position.origin`, adds `request.delta`, and persists
   * an atomic patch. Mirrors `onCommitOutlineEdit` for moves. The PlanViewport
   * owns a `CommandBus` instance internally so move commands can be undone
   * via Ctrl-Z while the viewport is focused.
   */
  onCommitMove?: (request: MoveRequest) => void;
};

export default function PlanViewport({
  artifact,
  visibility = DEFAULT_VISIBILITY,
  activeObjectRef,
  dimensions: providedDimensions,
  projectContextShapes,
  viewportTransform,
  onViewportTransformChange,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  onCommitOutlineEdit,
  onCommitMove,
}: PlanViewportProps) {
  const projection = artifact?.topProjection ?? null;
  const renderModel = usePlanRenderModel({ projection, visibility, activeObjectRef });
  const [edgeDragPreview, setEdgeDragPreview] = useState<EdgeDragPreview | null>(null);
  const [edgeDragHover, setEdgeDragHover] = useState<EdgeDragHover | null>(null);

  const selectTool = useMemo(
    () =>
      createSelectTool({
        onSelectObjectWorkbenchTarget,
        onSelectPergolaTarget,
        onClearWorkbenchSelection,
      }),
    [onClearWorkbenchSelection, onSelectObjectWorkbenchTarget, onSelectPergolaTarget],
  );

  const activeFamily = (activeObjectRef?.family ?? null) as ActiveObjectFamily | null;

  // Hold renderModel + activeFamily + onCommitOutlineEdit in refs so that the EdgeDragTool's
  // captured callbacks always read the latest values without forcing the tool to be re-created
  // on every parent render. Re-creating the tool mid-drag would tear down its session.
  const renderModelRef = useRef(renderModel);
  renderModelRef.current = renderModel;
  const activeFamilyRef = useRef(activeFamily);
  activeFamilyRef.current = activeFamily;
  const onCommitOutlineEditRef = useRef(onCommitOutlineEdit);
  onCommitOutlineEditRef.current = onCommitOutlineEdit;

  const getActiveOutline = useCallback(() => {
    const rm = renderModelRef.current;
    const af = activeFamilyRef.current;
    if (!rm || !af) return null;
    const candidate = pickPrimaryEditCandidate(
      rm.selectionHaloItems.map((item) => ({
        id: item.shape.id,
        polygon: item.shape.polygon,
        kind: item.shape.kind,
        isCanonicalOutline: item.shape.metadata?.isCanonicalOutline === true,
      })),
      af,
    );
    if (!candidate) return null;
    return { id: candidate.id, family: af, polygon: candidate.polygon };
  }, []);

  // Snap line targets — house wall edges + roof eaves + other pergolas'
  // outline edges projected to plan space. Read fresh on every drag-time
  // consult (via the ref) so re-solves between pointer events surface
  // up-to-date targets. Only pergola edits use snap in v1; deck/house
  // drags pass an empty list to fall through to natural delta. (Wired
  // here unconditionally — `EdgeDragTool` skips the snap path when
  // `lineTargets.length === 0`.)
  const houseModel = artifact?.assembly?.house?.model ?? null;
  const houseObjectId =
    artifact?.assembly?.house?.attachmentTarget?.metadata?.sourceFormId ?? 'house-main';
  const snapLineTargets = useMemo<SnapLineTarget[]>(() => {
    // Snap is meaningful for pergola edge drags (host attachment formation)
    // and for deck edge drags (decks attach to walls and pergola outline
    // edges). House drags are excluded because the house is itself a snap
    // target source — matching against its own walls would create self-snaps.
    //
    // Per-family rules:
    //   - pergolas: walls + roof eaves + OTHER pergolas' outline edges
    //     (`projectContextShapes` is already filtered upstream to drop the
    //      active pergola; eaves valid because pergolas attach at gutter)
    //   - decks: walls (no eaves — decks sit at ground level) + ALL pergolas'
    //     outline edges (`activePergolaSourceId` is null for non-pergola
    //     active objects, so `projectContextShapes` includes every pergola)
    if (activeFamily !== 'pergolas' && activeFamily !== 'decks') return [];
    const houseTargets = buildHouseSnapTargets({
      houseModel,
      houseObjectId: typeof houseObjectId === 'string' ? houseObjectId : 'house-main',
      kinds: activeFamily === 'pergolas' ? 'walls_and_eaves' : 'walls',
    });
    const pergolaTargets = projectContextShapes
      ? buildOtherPergolaSnapTargets({ shapes: projectContextShapes })
      : [];
    return [...houseTargets, ...pergolaTargets];
  }, [activeFamily, houseModel, houseObjectId, projectContextShapes]);
  const snapLineTargetsRef = useRef(snapLineTargets);
  snapLineTargetsRef.current = snapLineTargets;

  // CommandBus owns the undo/redo stack for moves originating in this
  // viewport. Created once per PlanViewport instance. Edge-drag commits
  // don't yet route through here (they're persisted directly via the
  // commit handler chain) — extending undo to cover edge drags is a
  // follow-up to milestone 14.
  const commandBus = useMemo(() => createCommandBus(), []);

  // Hold the SelectTool + onCommitMove in refs so the chained tools' captured
  // callbacks always read the latest values without forcing tool re-creation
  // on every parent render. Re-creating a tool mid-drag would tear down its
  // session.
  const selectToolRef = useRef(selectTool);
  selectToolRef.current = selectTool;
  const onCommitMoveRef = useRef(onCommitMove);
  onCommitMoveRef.current = onCommitMove;

  const moveTool = useMemo(
    () =>
      createMoveTool({
        // Pergolas + decks are first-class spatial entities with their own
        // `position.origin` (milestones 3 and 4). Openings are anchored to a
        // wall edge (no free position) so they can't translate via this tool.
        // House move requires more orchestration (audit row 5 / milestone 12);
        // ship pergola + deck for now and add house-form move when the
        // commit pipeline supports it.
        acceptedFamilies: ['pergola', 'deck'],
        commandBus,
        // Threshold below which a click-without-drag is discarded (pixel-level
        // jitter that shouldn't kick off a move). 5mm is roughly the same as
        // EdgeDragTool's hit tolerance — feels equivalent to the user.
        dragThresholdMm: 5,
        commitMove: (request) => onCommitMoveRef.current?.(request),
        // For moves, apply and invert use the same callback: positive delta
        // for apply, negative for invert (the MoveTool's `createMoveCommand`
        // builds the inverse request internally).
        invertMove: (request) => onCommitMoveRef.current?.(request),
        // When the click misses any movable target (empty area, decoration),
        // hand off to SelectTool so selection still works.
        onPointerDownFallthrough: (event) => {
          selectToolRef.current.onPointerDown?.(event);
        },
      }),
    [commandBus],
  );

  const moveToolRef = useRef(moveTool);
  moveToolRef.current = moveTool;

  const edgeDragTool = useMemo(
    () =>
      createEdgeDragTool({
        getActiveOutline,
        getSnapLineTargets: () => snapLineTargetsRef.current,
        onPreviewChange: setEdgeDragPreview,
        onHoverChange: setEdgeDragHover,
        onCommit: (commit) => onCommitOutlineEditRef.current?.(commit),
        // Tool chain: EdgeDrag -> Move -> Select. When a click misses the
        // active outline's edges, try MoveTool (translate body); MoveTool in
        // turn falls through to SelectTool when the click isn't on a movable
        // target.
        onPointerDownFallthrough: (event) => {
          moveToolRef.current.onPointerDown?.(event);
        },
      }),
    [getActiveOutline],
  );

  const activeOutlineForRender = renderModel !== null && activeFamily !== null ? getActiveOutline() : null;
  const hasEditableOutline = activeOutlineForRender !== null;
  // Composite tool: pointer-down enters the chain at EdgeDragTool (it falls
  // through to MoveTool then SelectTool via `onPointerDownFallthrough`).
  // Pointer-move and pointer-up fan out to BOTH EdgeDragTool and MoveTool —
  // each tool guards its own session, so only the one that started a drag
  // acts on these events. Without this fan-out, a move drag started via
  // EdgeDragTool's fallthrough would never receive its updates (the
  // dispatcher only routes to the single active tool, which is the entry
  // tool, not the chained tool that took the click).
  //
  // Cursor switches with `hasEditableOutline` for visual feedback, but the
  // tool id stays stable ('plan-tools') so `ToolDispatcher` doesn't cancel
  // active sessions when the cursor changes mid-render.
  const activeTool = useMemo<Tool>(
    () => ({
      id: 'plan-tools',
      cursor: hasEditableOutline ? 'crosshair' : 'default',
      onPointerDown: (event) => edgeDragTool.onPointerDown?.(event),
      onPointerMove: (event) => {
        edgeDragTool.onPointerMove?.(event);
        moveTool.onPointerMove?.(event);
      },
      onPointerUp: (event) => {
        edgeDragTool.onPointerUp?.(event);
        moveTool.onPointerUp?.(event);
      },
      onCancel: () => {
        edgeDragTool.onCancel?.();
        moveTool.onCancel?.();
      },
    }),
    [edgeDragTool, hasEditableOutline, moveTool],
  );

  // Ctrl-Z / Ctrl-Shift-Z keyboard shortcuts for the local CommandBus. Only
  // handle when no input is focused (so typing in the inspector doesn't
  // trigger an undo). Mac users: cmd-Z / cmd-shift-Z map to the same metaKey
  // path.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (event.shiftKey) commandBus.redo();
      else commandBus.undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandBus]);

  const mergedDimensions = usePlanSelectionDimensions({
    selectionHaloItems: renderModel?.selectionHaloItems,
    activeFamily,
    providedDimensions,
  });

  if (!projection || !renderModel) return <PlanViewportPlaceholder />;

  const screenAxisLabel = `${projection.screenAxis.x}_${projection.screenAxis.y}`;

  return (
    <div
      data-plan-viewport-host="true"
      data-plan-active-object-family={activeObjectRef?.family ?? ''}
      data-plan-active-object-id={activeObjectRef?.objectId ?? ''}
      className={lineweightStyles.tokens}
      style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'block' }}
    >
      <ToolDispatcherProvider initialTool={activeTool}>
        <PlanCanvas
          layout={renderModel.layout}
          coordinateAdapter={renderModel.adapter}
          committedBodies={renderModel.committedBodies}
          contextLines={renderModel.contextLines}
          detailLines={renderModel.detailLines}
          selectionHaloItems={renderModel.selectionHaloItems}
          dimensions={mergedDimensions}
          edgeDragPreview={edgeDragPreview}
          edgeDragHover={edgeDragHover}
          projectContextShapes={projectContextShapes}
          activeOutlinePolygon={activeOutlineForRender?.polygon ?? null}
          transform={viewportTransform}
          onTransformChange={onViewportTransformChange}
          screenAxisLabel={screenAxisLabel}
        />
      </ToolDispatcherProvider>
    </div>
  );
}
