'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import { topProjectionShapeClassifier } from '@/components/drawings/viewports/selection/selectionRouter';
import { createCommandBus } from '@/lib/drawings/commands/commandBus';
import {
  createReversibleCommand,
  type ReversibleCommandInput,
} from '@/lib/drawings/commands/createReversibleCommand';
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
import { createMoveTool, type MoveRequest, type MoveTarget, type MoveToolPreview } from './tools/MoveTool';
import { createPlanToolChain } from './tools/createPlanToolChain';
import {
  buildProjectHouseSnapTargets,
  type ProjectHouseSnapSource,
} from './interactions/snap/buildProjectHouseSnapTargets';
import { buildOtherPergolaSnapTargets } from './interactions/snap/buildOtherPergolaSnapTargets';
import type { SnapLineTarget } from './interactions/snap/snapEngine';

export type { EdgeDragCommit, EdgeDragHover, EdgeDragPreview } from './tools/EdgeDragTool';
export type { MoveRequest } from './tools/MoveTool';
export type { ProjectHouseSnapSource } from './interactions/snap/buildProjectHouseSnapTargets';
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
  projectionOverride?: GeometryTopProjectionViewModel | null;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  activeObjectRef?: WorkbenchObjectRef | null;
  dimensions?: ReadonlyArray<PlanDimension>;
  /**
   * Faded fallback outlines for pergolas without full project-wide plan
   * detail. Valid solved pergolas render via `projectPergolaPlanShapes`.
   */
  projectContextShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /**
   * Project-wide full pergola bodies. These are prefixed per pergola id and
   * promoted into the committed body graph so valid pergolas render together
   * instead of only the active one showing full detail.
   */
  projectPergolaPlanShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /**
   * Canonical pergola references used for snap targets. Kept separate from
   * `projectContextShapes`, which is visual fallback only once a pergola has
   * full project-wide detail.
   */
  projectPergolaSnapShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /**
   * Project-level house references promoted to committedBodies and hit
   * targets. This gives every house form the same selection and move path,
   * including the active pergola's host.
   */
  houseCommittedShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  /** Project-level house models used as wall/eave snap sources. */
  projectHouseSnapSources?: ReadonlyArray<ProjectHouseSnapSource>;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange: (next: DrawingWorkbenchViewportTransform) => void;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  /**
   * Click on a `house_terminal_end` marker (the inward-pointing hip
   * triangle in plan view). The handler must invert `currentlyOpen`
   * and commit the new `openGableEndIds` set on the active house draft.
   * Defined alongside the selection callbacks because the click flows
   * through the same SelectTool dispatch path -- the action variant
   * just routes elsewhere instead of mutating the selection.
   */
  onToggleHouseTerminalEnd?: (endId: string, currentlyOpen: boolean) => void;
  /**
   * Called when an edge drag commits. The host reads the new polygon, builds
   * a patch, and either:
   *   - returns a `ReversibleCommandInput` -- PlanViewport pushes it through
   *     the internal CommandBus so Ctrl-Z covers the resize. The host MUST
   *     snapshot pre-edit fields before computing the patch and pass them as
   *     the `invert` callback so undo can restore them.
   *   - returns `void` -- the host wrote the change directly (legacy
   *     fire-and-forget); no undo entry is created.
   */
  onCommitOutlineEdit?: (commit: EdgeDragCommit) => ReversibleCommandInput | void;
  /**
   * Called when the move tool commits a translate. The handler reads the
   * target's current `position.origin`, adds `request.delta`, and persists
   * an atomic patch. Mirrors `onCommitOutlineEdit` for moves. The PlanViewport
   * owns a `CommandBus` instance internally so move commands can be undone
   * via Ctrl-Z while the viewport is focused.
   */
  onCommitMove?: (request: MoveRequest) => void;
  /**
   * Cross-viewport hover state. When set (e.g. driven by 3D pointer-over),
   * PlanViewport renders a hover halo on the matching shape so the user
   * sees the same object highlighted across surfaces. Read-only from this
   * viewport's perspective -- it doesn't mutate this state, only emits via
   * `onHoverObjectChange` when its own pointer hovers a shape.
   */
  hoveredObjectRef?: WorkbenchObjectRef | null;
  /**
   * Called when the local pointer enters/leaves a top-projection shape in
   * plan. The shape is classified via `topProjectionShapeClassifier` into a
   * `WorkbenchObjectRef` (or `null` on leave) so consumers (e.g. 3D
   * viewport) can highlight the same object. This is the "emit" half of the
   * hover-sync contract documented in `docs/design-workbench-architecture.md`
   * milestone 16.
   */
  onHoverObjectChange?: (next: WorkbenchObjectRef | null) => void;
};

export default function PlanViewport({
  artifact,
  projectionOverride,
  visibility = DEFAULT_VISIBILITY,
  activeObjectRef,
  dimensions: providedDimensions,
  projectContextShapes,
  projectPergolaPlanShapes,
  projectPergolaSnapShapes,
  houseCommittedShapes,
  projectHouseSnapSources,
  viewportTransform,
  onViewportTransformChange,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  onToggleHouseTerminalEnd,
  onCommitOutlineEdit,
  onCommitMove,
  hoveredObjectRef,
  onHoverObjectChange,
}: PlanViewportProps) {
  const projection = projectionOverride ?? artifact?.topProjection ?? null;
  const renderModel = usePlanRenderModel({
    projection,
    visibility,
    activeObjectRef,
    hoveredObjectRef,
    houseReferenceShapes: houseCommittedShapes,
    projectPergolaPlanShapes,
    projectContextShapes,
  });
  const [edgeDragPreview, setEdgeDragPreview] = useState<EdgeDragPreview | null>(null);
  const [edgeDragHover, setEdgeDragHover] = useState<EdgeDragHover | null>(null);
  const [movePreview, setMovePreview] = useState<MoveToolPreview | null>(null);

  // Translate a hovered top-projection shape into a `WorkbenchObjectRef` and
  // emit upward. The classifier already encodes the deck/pergola/opening/
  // house disambiguation rules; we just adapt the result shape to the
  // ref-style envelope the rest of the workbench uses.
  const onHoverObjectChangeRef = useRef(onHoverObjectChange);
  onHoverObjectChangeRef.current = onHoverObjectChange;
  const handleHoverShape = useCallback((shape: GeometryTopProjectionShape | null) => {
    if (!shape) {
      onHoverObjectChangeRef.current?.(null);
      return;
    }
    const target = topProjectionShapeClassifier(shape);
    if (target.kind === 'pergola') {
      onHoverObjectChangeRef.current?.({ family: 'pergolas', objectId: target.pergolaId });
      return;
    }
    if (target.kind === 'workbench') {
      // Map the typed selection target's `targetKind` into the
      // ref-style `family` enum the workbench shell uses. Roof / footprint /
      // attachment_zone all live under the `house_forms` family.
      const family: WorkbenchObjectRef['family'] | null =
        target.targetKind === 'deck'
          ? 'decks'
          : target.targetKind === 'opening'
          ? 'openings'
          : target.targetKind === 'footprint' ||
            target.targetKind === 'roof' ||
            target.targetKind === 'house' ||
            target.targetKind === 'attachment_zone'
          ? 'house_forms'
          : null;
      if (!family) {
        onHoverObjectChangeRef.current?.(null);
        return;
      }
      onHoverObjectChangeRef.current?.({ family, objectId: target.targetId });
      return;
    }
    onHoverObjectChangeRef.current?.(null);
  }, []);

  const selectTool = useMemo(
    () =>
      createSelectTool({
        onSelectObjectWorkbenchTarget,
        onSelectPergolaTarget,
        onClearWorkbenchSelection,
        onToggleHouseTerminalEnd,
      }),
    [
      onClearWorkbenchSelection,
      onSelectObjectWorkbenchTarget,
      onSelectPergolaTarget,
      onToggleHouseTerminalEnd,
    ],
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
  // up-to-date targets. Pergola and deck edits use snap; house
  // drags pass an empty list to avoid self-snaps. (Wired
  // here unconditionally — `EdgeDragTool` skips the snap path when
  // `lineTargets.length === 0`.)
  const houseModel = artifact?.assembly?.house?.model ?? null;
  // PR-C (2026-05-22): `'house-main'` is the id buildSharedHouse currently
  // assigns to the synthesized primary form. Inlined here (was an imported
  // constant) since nothing special-cases the id anymore — it's just the
  // fallback when the attachment target has no `sourceFormId` metadata.
  // Retires entirely when PR-F makes attachment a real snap reference.
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
    //     (`projectPergolaSnapShapes` is filtered upstream to drop the
    //      active pergola; eaves valid because pergolas attach at gutter)
    //   - decks: walls (no eaves — decks sit at ground level) + ALL pergolas'
    //     outline edges (`activePergolaSourceId` is null for non-pergola
    //     active objects, so the snap shape list includes every pergola)
    const houseTargets = buildProjectHouseSnapTargets({
      activeFamily,
      projectHouseSnapSources,
      fallbackHouseModel: houseModel,
      fallbackHouseObjectId: typeof houseObjectId === 'string' ? houseObjectId : 'house-main',
    });
    const pergolaSnapShapes = projectPergolaSnapShapes ?? projectContextShapes;
    const pergolaTargets = pergolaSnapShapes
      ? buildOtherPergolaSnapTargets({ shapes: pergolaSnapShapes })
      : [];
    return [...houseTargets, ...pergolaTargets];
  }, [
    activeFamily,
    houseModel,
    houseObjectId,
    projectContextShapes,
    projectHouseSnapSources,
    projectPergolaSnapShapes,
  ]);
  const snapLineTargetsRef = useRef(snapLineTargets);
  snapLineTargetsRef.current = snapLineTargets;

  // CommandBus owns the undo/redo stack for edits originating in this
  // viewport. Created once per PlanViewport instance. Both move commits
  // (`MoveTool` -> `createMoveCommand`) and edge-drag commits (`onCommit`
  // returning a `ReversibleCommandInput` from the host -> wrapped here via
  // `createReversibleCommand`) land on the same bus, so Ctrl-Z covers
  // resize and translate uniformly.
  const commandBus = useMemo(() => createCommandBus(), []);

  // Hold the SelectTool + onCommitMove + active-target in refs so the
  // chained tools' captured callbacks always read the latest values without
  // forcing tool re-creation on every parent render. Re-creating a tool
  // mid-drag would tear down its session.
  const selectToolRef = useRef(selectTool);
  selectToolRef.current = selectTool;
  const onCommitMoveRef = useRef(onCommitMove);
  onCommitMoveRef.current = onCommitMove;
  const activeMoveTargetRef = useRef<MoveTarget | null>(null);
  activeMoveTargetRef.current = (() => {
    if (!activeObjectRef?.objectId) return null;
    if (activeObjectRef.family === 'pergolas') {
      return { family: 'pergola', targetId: activeObjectRef.objectId };
    }
    if (activeObjectRef.family === 'decks') {
      return { family: 'deck', targetId: activeObjectRef.objectId };
    }
    if (activeObjectRef.family === 'house_forms') {
      // Drag-to-reposition house forms in plan view. The host commit
      // writes the same object-first transform for the primary and added
      // forms; this ref only supplies the active target.
      return { family: 'house_form', targetId: activeObjectRef.objectId };
    }
    // Openings deferred — they're wall-anchored, not free-floating.
    return null;
  })();

  const moveTool = useMemo(
    () =>
      createMoveTool({
        // The single predicate that decides whether a click should move
        // something. Encodes both "is this family movable" (pergola + deck
        // yes; opening is wall-anchored; house is gated on multi-house data
        // model from milestone 13) AND "is this the active object"
        // (standard CAD UX: first click selects, subsequent click + drag
        // moves). Replaces the old acceptedFamilies + getActiveTarget pair.
        canMoveTarget: (target) => {
          const active = activeMoveTargetRef.current;
          if (!active) return false;
          return active.family === target.family && active.targetId === target.targetId;
        },
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
        // Live preview during drag: PlanMovePreviewLayer reads this state
        // and renders the active object's polygon translated by the
        // current delta. Without this wiring the user sees no visual
        // feedback until pointer-up commits the move.
        onPreviewChange: setMovePreview,
        // Snap during move: same target source as edge-drag (pre-filtered
        // per family at the host -- decks pass walls + other-pergola
        // outlines, pergolas additionally pass roof eaves). MoveTool
        // resolves the best snap across all polygon edges and applies the
        // correction along that edge's outward normal -- the parallel-to-
        // edge component of the natural drag is preserved so the user can
        // slide along the snap line freely. See `tools/resolveMoveSnap.ts`.
        getSnapLineTargets: () => snapLineTargetsRef.current,
        getActiveMovePolygon: () => {
          const outline = getActiveOutline();
          return outline ? outline.polygon : null;
        },
        // When the click misses any movable target (empty area, decoration,
        // or a non-active object), hand off to SelectTool.
        onPointerDownFallthrough: (event) => {
          selectToolRef.current.onPointerDown?.(event);
        },
      }),
    [commandBus, getActiveOutline],
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
        onCommit: (commit) => {
          // The host's commit handler may return a `ReversibleCommandInput`
          // describing the edit (with captured pre-edit fields) so we can
          // route it through the local `commandBus` and Ctrl-Z covers the
          // resize. Returning `void` keeps the legacy fire-and-forget shape
          // (no undo entry).
          const reversible = onCommitOutlineEditRef.current?.(commit);
          if (reversible) {
            commandBus.apply(createReversibleCommand(reversible));
          }
        },
        // Tool chain: EdgeDrag -> Move -> Select. When a click misses the
        // active outline's edges, try MoveTool (translate body); MoveTool in
        // turn falls through to SelectTool when the click isn't on a movable
        // target.
        onPointerDownFallthrough: (event) => {
          moveToolRef.current.onPointerDown?.(event);
        },
      }),
    [commandBus, getActiveOutline],
  );

  const activeOutlineForRender = renderModel !== null && activeFamily !== null ? getActiveOutline() : null;
  const hasEditableOutline = activeOutlineForRender !== null;
  const activeTool = useMemo(
    () =>
      createPlanToolChain({
        edgeDragTool,
        moveTool,
        cursor: hasEditableOutline ? 'crosshair' : 'default',
      }),
    [edgeDragTool, hasEditableOutline, moveTool],
  );

  // Keyboard shortcuts for the local CommandBus + tool chain. Only handle
  // when no input is focused (so typing in the inspector doesn't fire).
  // Mac users: cmd-Z / cmd-shift-Z map via the same metaKey path.
  //   Ctrl/Cmd-Z       => undo
  //   Ctrl/Cmd-Shift-Z => redo
  //   Esc              => cancel the active tool's drag (returns the
  //                       object to its pre-drag position; nothing
  //                       commits). Both `MoveTool.onCancel` and
  //                       `EdgeDragTool.onCancel` clear their session +
  //                       preview without firing the commit handler, so
  //                       no patch reaches the store.
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isEditableTarget) return;
      if (event.key === 'Escape' || event.key === 'Esc') {
        // Esc never participates in browser shortcuts here; cancel the
        // current drag (no-op when no drag is active).
        activeToolRef.current.onCancel?.();
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== 'z') return;
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
          hoverHaloItems={renderModel.hoverHaloItems}
          onHoverShape={handleHoverShape}
          dimensions={mergedDimensions}
          edgeDragPreview={edgeDragPreview}
          edgeDragHover={edgeDragHover}
          movePreview={movePreview}
          // The polygon to translate during a move preview. Use the active
          // outline's polygon (the same shape the selection halo wraps)
          // so the preview tracks what the user thinks they're moving.
          movePreviewSourcePolygon={activeOutlineForRender?.polygon ?? null}
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
