import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { ProjectHouseProjectionHealth } from './state/projectHouseProjectionHealth';
import type { HouseFormGeometryInputDiagnostics } from './state/houseFormGeometryInput';
import type { ProjectPergolaRenderHealth } from './state/projectObjectRenderPipeline';
import type { WorkbenchSolvedProjectArtifact } from './state/workbenchSolvedProjectArtifact';
import type {
  DrawingWorkbenchUiState,
} from './state/drawingWorkbenchUiState';

export type WorkbenchDebugFixtureExport = {
  objectFirst: EstimateDrawingDraft['objectFirst'] | null;
  selectedState: {
    activeObjectRef: DrawingWorkbenchUiState['activeObjectRef'];
    activePergolaId: string | null;
    viewportMode: DrawingWorkbenchUiState['viewportMode'];
  };
  renderDiagnostics: {
    projectArtifactSource: WorkbenchSolvedProjectArtifact['source'] | null;
    projectPreviewSource: string | null;
    houseGeometryInputsById: Record<string, HouseFormGeometryInputDiagnostics>;
    projectHouseProjectionHealth: ProjectHouseProjectionHealth[];
    projectPergolaRenderHealth: ProjectPergolaRenderHealth[];
  };
};

export function buildWorkbenchDebugFixtureExport(input: {
  draft: EstimateDrawingDraft | null | undefined;
  ui: DrawingWorkbenchUiState;
  projectArtifact: WorkbenchSolvedProjectArtifact | null | undefined;
}): WorkbenchDebugFixtureExport {
  const artifactGeometryPreview = input.projectArtifact?.geometryPreview ?? null;
  return {
    objectFirst: input.draft?.objectFirst ?? null,
    selectedState: {
      activeObjectRef: input.ui.activeObjectRef,
      activePergolaId: input.ui.activePergolaId,
      viewportMode: input.ui.viewportMode,
    },
    renderDiagnostics: {
      projectArtifactSource: input.projectArtifact?.source ?? null,
      projectPreviewSource:
        artifactGeometryPreview?.kind === 'ready'
          ? String(artifactGeometryPreview.scene.metadata?.projectPreviewSource ?? '')
          : artifactGeometryPreview?.kind ?? null,
      houseGeometryInputsById: {
        ...(input.projectArtifact?.diagnostics.houseGeometryInputsById ?? {}),
      },
      projectHouseProjectionHealth: [
        ...(input.projectArtifact?.diagnostics.projectHouseProjectionHealth ?? []),
      ],
      projectPergolaRenderHealth: [
        ...(input.projectArtifact?.diagnostics.projectPergolaRenderHealth ?? []),
      ],
    },
  };
}
