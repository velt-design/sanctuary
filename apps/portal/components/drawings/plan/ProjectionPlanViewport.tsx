import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchPlanCustomEdgeCandidate,
  ObjectWorkbenchPlanOverlay,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { ObjectWorkbenchPreviewOverlay } from '@/app/staff/calculator/ModuleDrawingContracts';
import type { ModuleFootprintEditorProps } from '@/app/staff/calculator/ModuleDrawingContracts';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import { ProjectionPlanSvg } from './ProjectionPlanSvg';
import type { ProjectionPlanShapeDragStartMeta } from './ProjectionPlanLayers';

export type ProjectionPlanViewportProps = {
  artifact: WorkbenchSolvedGeometryArtifact;
  visibility?: DrawingWorkbenchVisibilityState;
  activeObjectRef?: WorkbenchObjectRef | null;
  objectWorkbenchPlanOverlay?: ObjectWorkbenchPlanOverlay | null;
  objectWorkbenchPreviewOverlay?: ObjectWorkbenchPreviewOverlay | null;
  legacyFootprintEditPlanModel?: ModulePlanModel | null;
  footprintEditor?: ModuleFootprintEditorProps;
  pergolaTargetId?: string | null;
  hoveredObjectWorkbenchDeckId?: string | null;
  activeObjectWorkbenchCustomEdgeId?: string | null;
  onSelectObjectWorkbenchTarget?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  onObjectWorkbenchDeckHoverChange?: (deckId: string | null) => void;
  onObjectWorkbenchShapeDragStart?: (
    meta: ProjectionPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onObjectWorkbenchCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onObjectWorkbenchDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
  onSvgMount?: (node: SVGSVGElement | null) => void;
  onCanvasPointResolverChange?: ModuleFootprintEditorProps['onCanvasPointResolverChange'];
  onPlanPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
  onDeckDragPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
};

export default function ProjectionPlanViewport({
  artifact,
  visibility,
  activeObjectRef,
  objectWorkbenchPlanOverlay,
  objectWorkbenchPreviewOverlay,
  legacyFootprintEditPlanModel,
  footprintEditor,
  pergolaTargetId,
  hoveredObjectWorkbenchDeckId,
  activeObjectWorkbenchCustomEdgeId,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  onObjectWorkbenchDeckHoverChange,
  onObjectWorkbenchShapeDragStart,
  onObjectWorkbenchCustomEdgeSelect,
  onObjectWorkbenchDimensionActivate,
  onSvgMount,
  onCanvasPointResolverChange,
  onPlanPointResolverChange,
  onDeckDragPointResolverChange,
}: ProjectionPlanViewportProps) {
  void activeObjectRef;
  return (
    <ProjectionPlanSvg
      artifact={artifact}
      visibility={visibility}
      objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
      objectWorkbenchPreviewOverlay={objectWorkbenchPreviewOverlay}
      legacyFootprintEditPlanModel={legacyFootprintEditPlanModel}
      footprintEditor={footprintEditor}
      pergolaTargetId={pergolaTargetId}
      hoveredObjectWorkbenchDeckId={hoveredObjectWorkbenchDeckId}
      activeObjectWorkbenchCustomEdgeId={activeObjectWorkbenchCustomEdgeId}
      onObjectWorkbenchShapeSelect={onSelectObjectWorkbenchTarget}
      onPergolaSelect={onSelectPergolaTarget}
      onObjectWorkbenchDeckHoverChange={onObjectWorkbenchDeckHoverChange}
      onCanvasSelect={onClearWorkbenchSelection}
      onObjectWorkbenchShapeDragStart={onObjectWorkbenchShapeDragStart}
      onObjectWorkbenchCustomEdgeSelect={onObjectWorkbenchCustomEdgeSelect}
      onObjectWorkbenchDimensionActivate={onObjectWorkbenchDimensionActivate}
      onSvgMount={onSvgMount}
      onCanvasPointResolverChange={onCanvasPointResolverChange}
      onPlanPointResolverChange={onPlanPointResolverChange}
      onDeckDragPointResolverChange={onDeckDragPointResolverChange}
    />
  );
}
