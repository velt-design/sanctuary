import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { HouseFormGeometryInputDiagnostics } from './houseFormGeometryInput';
import type {
  ProjectHouseGeometryEntry,
} from './projectHouseGeometryRegistry';
import { buildProjectContextOverlayShapes } from './projectContextOverlayShapes';
import type { ProjectHouseProjectionHealth } from './projectHouseProjectionHealth';
import type { ProjectPergolaRenderHealth } from './projectObjectRenderPipeline';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import type {
  GeometryPreviewState,
  WorkbenchTrustStatus,
  WorkbenchViewportGeometry,
} from './workbenchSolvedModel';
import {
  buildWorkbenchDrawingSurfaceGeometry,
  type WorkbenchDrawingSurfaceGeometry,
} from '../views/workbenchDrawingSurfaceGeometry';

type WorkbenchProjectHouseSnapSource = {
  houseFormId: string;
  model: ProjectHouseGeometryEntry['model'];
};

type WorkbenchSolvedObjectDiagnostics = {
  houses: Record<
    string,
    {
      objectId: string;
      houseFormId: string;
      hasGeometryModel: boolean;
      geometryInput: HouseFormGeometryInputDiagnostics | null;
      projectionHealth: ProjectHouseProjectionHealth | null;
    }
  >;
  pergolas: Record<string, ProjectPergolaRenderHealth>;
};

export type WorkbenchSolvedProjectArtifact = {
  source: 'workbench_solved_project';
  viewportGeometry: WorkbenchViewportGeometry | null;
  geometryPreview: GeometryPreviewState;
  drawingSurfaceGeometry: WorkbenchDrawingSurfaceGeometry;
  planProjection: GeometryTopProjectionViewModel | null;
  planLayers: {
    committedPergolaShapes: GeometryTopProjectionShape[];
    diagnosticPergolaShapes: GeometryTopProjectionShape[];
    houseCommittedShapes: GeometryTopProjectionShape[];
    canonicalPergolaSnapShapes: GeometryTopProjectionShape[];
  };
  snapSources: {
    house: WorkbenchProjectHouseSnapSource[];
    pergolaShapes: GeometryTopProjectionShape[];
  };
  diagnostics: {
    houseGeometryInputsById: Record<string, HouseFormGeometryInputDiagnostics>;
    projectHouseProjectionHealth: ProjectHouseProjectionHealth[];
    projectPergolaRenderHealth: ProjectPergolaRenderHealth[];
    trust: WorkbenchTrustStatus;
  };
  objectsById: WorkbenchSolvedObjectDiagnostics;
};

function buildWorkbenchSolvedObjectDiagnostics(input: {
  projectModel: WorkbenchProjectModel;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
  projectHouseProjectionHealth: ReadonlyArray<ProjectHouseProjectionHealth>;
  houseGeometryInputsById: Readonly<Record<string, HouseFormGeometryInputDiagnostics>>;
  projectPergolaRenderHealth: ReadonlyArray<ProjectPergolaRenderHealth>;
}): WorkbenchSolvedObjectDiagnostics {
  const houseModelsById = new Set(input.projectHouseGeometries.map((entry) => entry.houseFormId));
  const projectionHealthById = new Map(
    input.projectHouseProjectionHealth.map((entry) => [entry.houseFormId, entry]),
  );
  const houses: WorkbenchSolvedObjectDiagnostics['houses'] = {};
  for (const houseForm of input.projectModel.houseAssembly?.houseForms ?? []) {
    houses[houseForm.id] = {
      objectId: houseForm.id,
      houseFormId: houseForm.id,
      hasGeometryModel: houseModelsById.has(houseForm.id),
      geometryInput: input.houseGeometryInputsById[houseForm.id] ?? null,
      projectionHealth: projectionHealthById.get(houseForm.id) ?? null,
    };
  }

  const pergolas: WorkbenchSolvedObjectDiagnostics['pergolas'] = {};
  for (const health of input.projectPergolaRenderHealth) {
    const key = health.pergolaId || health.artifactId;
    if (key) pergolas[key] = health;
  }

  return { houses, pergolas };
}

export function buildWorkbenchSolvedProjectArtifact(input: {
  projectModel: WorkbenchProjectModel;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
  projectPergolaPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectPergolaFallbackPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectPergolaRenderHealth: ReadonlyArray<ProjectPergolaRenderHealth>;
  projectHouseProjectionHealth: ReadonlyArray<ProjectHouseProjectionHealth>;
  houseGeometryInputsById: Readonly<Record<string, HouseFormGeometryInputDiagnostics>>;
  projectPlanProjection: GeometryTopProjectionViewModel | null;
  projectViewportGeometry: WorkbenchViewportGeometry | null;
  projectGeometryPreview: GeometryPreviewState;
  projectReferenceShapes: ReadonlyArray<GeometryTopProjectionShape>;
  trust: WorkbenchTrustStatus;
}): WorkbenchSolvedProjectArtifact {
  const houseCommittedShapes = input.projectReferenceShapes.filter(
    (shape) => shape.sourceType === 'house_reference',
  );
  const canonicalPergolaSnapShapes = buildProjectContextOverlayShapes({
    projectReferenceShapes: input.projectReferenceShapes,
    activePergolaSourceId: null,
  });
  const drawingSurfaceGeometry = buildWorkbenchDrawingSurfaceGeometry({
    viewportGeometry: input.projectViewportGeometry,
  });

  return {
    source: 'workbench_solved_project',
    viewportGeometry: input.projectViewportGeometry,
    geometryPreview: input.projectGeometryPreview,
    drawingSurfaceGeometry,
    planProjection: input.projectPlanProjection,
    planLayers: {
      committedPergolaShapes: [...input.projectPergolaPlanShapes],
      diagnosticPergolaShapes: [...input.projectPergolaFallbackPlanShapes],
      houseCommittedShapes,
      canonicalPergolaSnapShapes,
    },
    snapSources: {
      house: input.projectHouseGeometries.map((entry) => ({
        houseFormId: entry.houseFormId,
        model: entry.model,
      })),
      pergolaShapes: canonicalPergolaSnapShapes,
    },
    diagnostics: {
      houseGeometryInputsById: { ...input.houseGeometryInputsById },
      projectHouseProjectionHealth: [...input.projectHouseProjectionHealth],
      projectPergolaRenderHealth: [...input.projectPergolaRenderHealth],
      trust: input.trust,
    },
    objectsById: buildWorkbenchSolvedObjectDiagnostics({
      projectModel: input.projectModel,
      projectHouseGeometries: input.projectHouseGeometries,
      projectHouseProjectionHealth: input.projectHouseProjectionHealth,
      houseGeometryInputsById: input.houseGeometryInputsById,
      projectPergolaRenderHealth: input.projectPergolaRenderHealth,
    }),
  };
}
