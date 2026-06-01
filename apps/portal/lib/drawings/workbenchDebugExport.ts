import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { ProjectHouseProjectionHealth } from './state/projectHouseProjectionHealth';
import type { HouseFormGeometryInputDiagnostics } from './state/houseFormGeometryInput';
import type { ProjectPergolaRenderHealth } from './state/projectObjectRenderPipeline';
import type { GeometryPreviewState } from './state/workbenchSolvedModel';
import type {
  DrawingWorkbenchUiState,
} from './state/drawingWorkbenchUiState';

export type WorkbenchDebugFixtureExport = {
  snapshot: Record<string, unknown> | null;
  objectFirst: EstimateDrawingDraft['objectFirst'] | null;
  selectedState: {
    activeObjectRef: DrawingWorkbenchUiState['activeObjectRef'];
    activePergolaId: string | null;
    activeModuleIndex: number;
    viewportMode: DrawingWorkbenchUiState['viewportMode'];
  };
  renderDiagnostics: {
    projectPreviewSource: string | null;
    houseGeometryInputsById: Record<string, HouseFormGeometryInputDiagnostics>;
    projectHouseProjectionHealth: ProjectHouseProjectionHealth[];
    projectPergolaRenderHealth: ProjectPergolaRenderHealth[];
  };
};

export function buildWorkbenchDebugFixtureExport(input: {
  snapshot: Record<string, unknown> | null;
  draft: EstimateDrawingDraft | null | undefined;
  ui: DrawingWorkbenchUiState;
  projectGeometryPreview: GeometryPreviewState | null | undefined;
  houseGeometryInputsById: Readonly<Record<string, HouseFormGeometryInputDiagnostics>>;
  projectHouseProjectionHealth: ReadonlyArray<ProjectHouseProjectionHealth>;
  projectPergolaRenderHealth: ReadonlyArray<ProjectPergolaRenderHealth>;
}): WorkbenchDebugFixtureExport {
  return {
    snapshot: input.snapshot,
    objectFirst: input.draft?.objectFirst ?? null,
    selectedState: {
      activeObjectRef: input.ui.activeObjectRef,
      activePergolaId: input.ui.activePergolaId,
      activeModuleIndex: input.ui.activeModuleIndex,
      viewportMode: input.ui.viewportMode,
    },
    renderDiagnostics: {
      projectPreviewSource:
        input.projectGeometryPreview?.kind === 'ready'
          ? String(input.projectGeometryPreview.scene.metadata?.projectPreviewSource ?? '')
          : input.projectGeometryPreview?.kind ?? null,
      houseGeometryInputsById: { ...input.houseGeometryInputsById },
      projectHouseProjectionHealth: [...input.projectHouseProjectionHealth],
      projectPergolaRenderHealth: [...input.projectPergolaRenderHealth],
    },
  };
}
