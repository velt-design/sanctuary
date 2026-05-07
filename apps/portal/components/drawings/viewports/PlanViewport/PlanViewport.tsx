'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { GeometryTopProjectionShape } from '@sp/geometry';
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
import { buildHouseSnapTargets } from './interactions/snap/buildHouseSnapTargets';
import { buildOtherPergolaSnapTargets } from './interactions/snap/buildOtherPergolaSnapTargets';
import type { SnapLineTarget } from './interactions/snap/snapEngine';

export type { EdgeDragCommit, EdgeDragHover, EdgeDragPreview } from './tools/EdgeDragTool';
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

  // Hold the SelectTool in a ref so EdgeDragTool's fall-through can hand off
  // pointer-down events to it without forcing EdgeDragTool re-creation when
  // the SelectTool callback identities change.
  const selectToolRef = useRef(selectTool);
  selectToolRef.current = selectTool;

  const edgeDragTool = useMemo(
    () =>
      createEdgeDragTool({
        getActiveOutline,
        getSnapLineTargets: () => snapLineTargetsRef.current,
        onPreviewChange: setEdgeDragPreview,
        onHoverChange: setEdgeDragHover,
        onCommit: (commit) => onCommitOutlineEditRef.current?.(commit),
        // When a click misses the active outline's edges, hand the pointer event
        // to the SelectTool so the user can switch selection by clicking on a
        // different object in the plan view (matching left-nav behaviour).
        onPointerDownFallthrough: (event) => {
          selectToolRef.current.onPointerDown?.(event);
        },
      }),
    [getActiveOutline],
  );

  const activeOutlineForRender = renderModel !== null && activeFamily !== null ? getActiveOutline() : null;
  const hasEditableOutline = activeOutlineForRender !== null;
  const activeTool = hasEditableOutline ? edgeDragTool : selectTool;

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
