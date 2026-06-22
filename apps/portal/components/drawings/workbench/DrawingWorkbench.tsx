'use client';

import type { WorkbenchViewStatus } from '@/lib/drawings/workbenchViewTypes';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type {
  DrawingWorkbenchViewportMode,
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { WorkbenchViewportGeometry } from '@/lib/drawings/state/workbenchSolvedModel';
import type { WorkbenchSolvedProjectArtifact } from '@/lib/drawings/state/workbenchSolvedProjectArtifact';
import type { PlanSeamIconForm } from '@/components/drawings/viewports/PlanViewport/interactions/seams/seamIconTargets';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import type { EdgeDragCommit } from '@/components/drawings/viewports/PlanViewport/tools/EdgeDragTool';
import type {
  HouseTerminalEndToggleRequest,
  MoveRequest,
} from '@/components/drawings/viewports/PlanViewport/PlanViewport';
import WorkbenchChrome from './WorkbenchChrome';
import WorkbenchViewportHost from './WorkbenchViewportHost';
import styles from './DrawingWorkbench.module.css';

type DrawingWorkbenchProps = {
  sheetLabel: string;
  viewportMode: DrawingWorkbenchViewportMode;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
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
  backHref?: string;
  /** Project name shown at the top-left of the workbench chrome. */
  projectLabel?: string | null;
  draftSaveAction?: {
    label: string;
    statusText: string | null;
    disabled: boolean;
    onSave: () => void;
  } | null;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  onToggleHouseTerminalEnd?: (request: HouseTerminalEndToggleRequest) => void;
  onCommitOutlineEdit?: (commit: EdgeDragCommit) => void;
  onCommitMove?: (request: MoveRequest) => void;
  /** Cross-viewport hover state (milestone 16). Pass-through to viewports. */
  hoveredObjectRef?: WorkbenchObjectRef | null;
  onHoverObjectChange?: (next: WorkbenchObjectRef | null) => void;
  /** PR-COMP-PHASE4b.3: pass-through to PlanViewport's seam-icon layer. */
  projectHouseFormCompositions?: ReadonlyArray<PlanSeamIconForm>;
  onJoinHouseForms?: (input: { formAId: string; formBId: string }) => void;
  onDetachHouseFormAtSeam?: (input: { houseFormId: string; joinIndex: number }) => void;
};

export default function DrawingWorkbench({
  sheetLabel,
  viewportMode,
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
  onViewportModeChange,
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
  backHref,
  projectLabel,
  draftSaveAction,
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
}: DrawingWorkbenchProps) {
  return (
    <section className={styles.workbench} aria-label="Drawing workbench">
      <WorkbenchChrome
        viewportMode={viewportMode}
        onViewportModeChange={onViewportModeChange}
        backHref={backHref}
        projectLabel={projectLabel ?? null}
        draftSaveAction={draftSaveAction ?? null}
      />
      <WorkbenchViewportHost
        sheetLabel={sheetLabel}
        viewportMode={viewportMode}
        objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
        visibility={visibility}
        status={status}
        projectArtifact={projectArtifact}
        viewportGeometry={viewportGeometry}
        drawingSurfaceGeometry={drawingSurfaceGeometry}
        activeObjectRef={activeObjectRef}
        modelViewportTransform={modelViewportTransform}
        geometryViewportKey={geometryViewportKey}
        geometryViewportState={geometryViewportState}
        onModelViewportTransformChange={onModelViewportTransformChange}
        onGeometryViewportStateChange={onGeometryViewportStateChange}
        meta={meta}
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
    </section>
  );
}
