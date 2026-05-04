import type {
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';
import type { ObjectWorkbenchViewportTargetSelection } from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import { ProjectionTopSvg } from './ProjectionTopSvg';

type ProjectionTopViewportProps = {
  artifact: WorkbenchSolvedGeometryArtifact;
  visibility?: DrawingWorkbenchVisibilityState;
  activeObjectRef?: WorkbenchObjectRef | null;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange?: (next: DrawingWorkbenchViewportTransform) => void;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onClearWorkbenchSelection?: () => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
};

export default function ProjectionTopViewport({
  artifact,
  visibility,
  activeObjectRef,
  viewportTransform,
  onViewportTransformChange,
  onSelectObjectWorkbenchTarget,
  onClearWorkbenchSelection,
  onSelectPergolaTarget,
}: ProjectionTopViewportProps) {
  void viewportTransform;
  void onViewportTransformChange;
  return (
    <ProjectionTopSvg
      artifact={artifact}
      visibility={visibility}
      activeObjectRef={activeObjectRef}
      onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
      onClearWorkbenchSelection={onClearWorkbenchSelection}
      onSelectPergolaTarget={onSelectPergolaTarget}
    />
  );
}
