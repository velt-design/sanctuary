'use client';

import type { WorkbenchViewStatus } from '@/lib/drawings/workbenchViewTypes';
import type {
  DrawingWorkbenchViewportMode,
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  WorkbenchViewportGeometry,
} from '@/lib/drawings/state/workbenchSolvedModel';
import type { WorkbenchSolvedProjectArtifact } from '@/lib/drawings/state/workbenchSolvedProjectArtifact';
import {
  buildWorkbenchDrawingSurfaceGeometry,
  type WorkbenchDrawingSurfaceGeometry,
} from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import { type Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import DesignViewport from '@/components/drawings/viewports/DesignViewport';
import type { PlanSeamIconForm } from '@/components/drawings/viewports/PlanViewport/interactions/seams/seamIconTargets';
import type { EdgeDragCommit } from '@/components/drawings/viewports/PlanViewport/tools/EdgeDragTool';
import PlanViewport, {
  type HouseTerminalEndToggleRequest,
  type MoveRequest,
} from '@/components/drawings/viewports/PlanViewport/PlanViewport';
import SheetViewport from '@/components/drawings/viewports/SheetViewport';
import styles from './DrawingWorkbench.module.css';

type WorkbenchViewportHostProps = {
  sheetLabel: string;
  viewportMode: DrawingWorkbenchViewportMode;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  status: WorkbenchViewStatus;
  projectArtifact?: WorkbenchSolvedProjectArtifact | null;
  viewportGeometry?: WorkbenchViewportGeometry | null;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  activeObjectRef?: WorkbenchObjectRef | null;
  modelViewportTransform: DrawingWorkbenchViewportTransform;
  geometryViewportKey?: string;
  geometryViewportState?: Geometry3DViewportState | null;
  onModelViewportTransformChange: (transform: DrawingWorkbenchViewportTransform) => void;
  onGeometryViewportStateChange?: (state: Geometry3DViewportState) => void;
  meta: EstimateDrawingSheetMeta;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  onToggleHouseTerminalEnd?: (request: HouseTerminalEndToggleRequest) => void;
  onCommitOutlineEdit?: (commit: EdgeDragCommit) => void;
  onCommitMove?: (request: MoveRequest) => void;
  /**
   * PR-COMP-PHASE4b.3 (2026-06-18): per-house-form composition +
   * world transform powering the Join / Detach seam-icon layer in
   * PlanViewport. Built upstream from the workbench draft's
   * `houseAssembly.houseForms`; only forms with a `composition`
   * appear here.
   */
  projectHouseFormCompositions?: ReadonlyArray<PlanSeamIconForm>;
  onJoinHouseForms?: (input: { formAId: string; formBId: string }) => void;
  onDetachHouseFormAtSeam?: (input: { houseFormId: string; joinIndex: number }) => void;
  /**
   * Cross-viewport hover state (milestone 16). PlanViewport emits via
   * `onHoverObjectChange` when the local pointer enters a shape; the host
   * threads it through to whichever viewport is currently rendered. Phase
   * 1 wires the prop end-to-end without yet rendering hover styling in 3D.
   */
  hoveredObjectRef?: WorkbenchObjectRef | null;
  onHoverObjectChange?: (next: WorkbenchObjectRef | null) => void;
};

export default function WorkbenchViewportHost({
  sheetLabel,
  viewportMode,
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
  status,
  projectArtifact,
  viewportGeometry,
  drawingSurfaceGeometry,
  activeObjectRef,
  modelViewportTransform,
  geometryViewportKey,
  geometryViewportState,
  onModelViewportTransformChange,
  onGeometryViewportStateChange,
  meta,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  onToggleHouseTerminalEnd,
  onCommitOutlineEdit,
  onCommitMove,
  hoveredObjectRef,
  onHoverObjectChange,
  projectHouseFormCompositions,
  onJoinHouseForms,
  onDetachHouseFormAtSeam,
}: WorkbenchViewportHostProps) {
  const artifactGeometryPreview = projectArtifact?.geometryPreview ?? null;
  const artifactPlanProjection = projectArtifact?.planProjection ?? null;
  const diagnosticPergolaPlanShapes = projectArtifact?.planLayers.diagnosticPergolaShapes ?? [];
  const committedPergolaPlanShapes = projectArtifact?.planLayers.committedPergolaShapes ?? [];
  const housePlanReferenceShapes = projectArtifact?.planLayers.houseCommittedShapes ?? [];
  const houseProjectionHealth =
    projectArtifact?.diagnostics.projectHouseProjectionHealth ?? [];
  const houseSnapSources = projectArtifact?.snapSources.house ?? [];
  const activePergolaSourceId =
    activeObjectRef?.family === 'pergolas'
      ? activeObjectRef.objectId ?? null
      : null;
  const projectPergolaSnapShapes =
    activePergolaSourceId
      ? (projectArtifact?.snapSources.pergolaShapes ?? []).filter(
          (shape) =>
            shape.sourceType !== 'pergola_reference' ||
            shape.sourceObjectId !== activePergolaSourceId,
        )
      : projectArtifact?.snapSources.pergolaShapes ?? [];
  const routedDrawingSurfaceGeometry =
    drawingSurfaceGeometry ??
    projectArtifact?.drawingSurfaceGeometry ??
    buildWorkbenchDrawingSurfaceGeometry({
      viewportGeometry: viewportGeometry ?? null,
    });
  const projectDrawingSurfaceGeometry = projectArtifact?.drawingSurfaceGeometry ?? null;
  const routedPlanDrawingSurfaceGeometry =
    routedDrawingSurfaceGeometry?.artifact
      ? routedDrawingSurfaceGeometry
      : projectDrawingSurfaceGeometry ?? routedDrawingSurfaceGeometry;
  const routedGeometryPreview = artifactGeometryPreview ?? viewportGeometry?.preview ?? null;
  const planViewportProjectProps = {
    projectContextShapes: diagnosticPergolaPlanShapes,
    projectPergolaPlanShapes: committedPergolaPlanShapes,
    projectPergolaSnapShapes,
    houseCommittedShapes: housePlanReferenceShapes,
    projectHouseSnapSources: houseSnapSources,
  };
  const designViewportProjectProps = {
    projectHouseProjectionHealth: houseProjectionHealth,
  };

  return (
    <div className={styles.viewport}>
      {viewportMode === 'sheet' ? (
        <SheetViewport
          sheetLabel={sheetLabel}
          status={status}
          drawingSurfaceGeometry={routedDrawingSurfaceGeometry}
          meta={meta}
        />
      ) : viewportMode === 'plan' ? (
        <PlanViewport
          artifact={routedPlanDrawingSurfaceGeometry?.artifact ?? null}
          projectionOverride={artifactPlanProjection ?? null}
          objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
          visibility={visibility}
          activeObjectRef={activeObjectRef}
          {...planViewportProjectProps}
          viewportTransform={modelViewportTransform}
          onViewportTransformChange={onModelViewportTransformChange}
          onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
          onSelectPergolaTarget={onSelectPergolaTarget}
          onClearWorkbenchSelection={onClearWorkbenchSelection}
          onToggleHouseTerminalEnd={onToggleHouseTerminalEnd}
          onCommitOutlineEdit={onCommitOutlineEdit}
          onCommitMove={onCommitMove}
          hoveredObjectRef={hoveredObjectRef}
          onHoverObjectChange={onHoverObjectChange}
          projectHouseFormCompositions={projectHouseFormCompositions}
          onJoinHouseForms={onJoinHouseForms}
          onDetachHouseFormAtSeam={onDetachHouseFormAtSeam}
        />
      ) : (
        <DesignViewport
          geometryPreview={routedGeometryPreview}
          objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
          visibility={visibility}
          viewportKey={geometryViewportKey ?? `${objectWorkbenchDisplayFamily}:project`}
          viewportState={geometryViewportState}
          onViewportStateChange={onGeometryViewportStateChange}
          selectedObjectId={activeObjectRef?.objectId}
          onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
          onSelectPergolaTarget={onSelectPergolaTarget}
          onClearWorkbenchSelection={onClearWorkbenchSelection}
          hoveredObjectId={hoveredObjectRef?.objectId ?? null}
          {...designViewportProjectProps}
        />
      )}
    </div>
  );
}
