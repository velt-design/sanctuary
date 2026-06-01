import type { GeometryTopProjectionShape } from '@sp/geometry';
import { buildProjectPergolaViewerSceneFromModules } from './projectPergolaViewerScene';
import type { ProjectHouseGeometryEntry } from './projectHouseGeometryRegistry';
import type { ProjectPergolaRenderHealth } from './projectObjectRenderPipeline';
import type { GeometryPreviewState, WorkbenchSolvedModule } from './workbenchSolvedModel';

type ProjectGeometryPreviewSource =
  | 'project_pipeline'
  | 'diagnostic_project_scene'
  | 'legacy_active_module_fallback';

export const PROJECT_GEOMETRY_PREVIEW_SOURCE_METADATA_KEY = 'projectPreviewSource';

function renderablePergolaIds(
  health: ReadonlyArray<ProjectPergolaRenderHealth>,
): Set<string> {
  return new Set(
    health
      .filter((entry) => entry.canRenderCommittedBody)
      .map((entry) => entry.pergolaId),
  );
}

function withProjectPreviewSource(
  preview: GeometryPreviewState,
  source: ProjectGeometryPreviewSource,
): GeometryPreviewState {
  if (preview.kind !== 'ready') return preview;
  return {
    ...preview,
    scene: {
      ...preview.scene,
      metadata: {
        ...(preview.scene.metadata ?? {}),
        [PROJECT_GEOMETRY_PREVIEW_SOURCE_METADATA_KEY]: source,
      },
    },
  };
}

function readyPreviewCarrier(input: {
  modules: ReadonlyArray<WorkbenchSolvedModule>;
  activeModule: WorkbenchSolvedModule | null;
}): WorkbenchSolvedModule | null {
  if (input.activeModule?.geometryPreview.kind === 'ready') {
    return input.activeModule;
  }
  return input.modules.find((module) => module.geometryPreview.kind === 'ready') ?? null;
}

export function resolveProjectReadyBasisModule(input: {
  modules: ReadonlyArray<WorkbenchSolvedModule>;
  activeModule: WorkbenchSolvedModule | null;
  projectPergolaRenderHealth?: ReadonlyArray<ProjectPergolaRenderHealth>;
}): WorkbenchSolvedModule | null {
  const healthByPergolaId = new Map(
    (input.projectPergolaRenderHealth ?? [])
      .filter((entry) => entry.pergolaId)
      .map((entry) => [entry.pergolaId, entry]),
  );
  const isRenderable = (module: WorkbenchSolvedModule): boolean => {
    const pergolaId = module.moduleInput.pergolaId;
    if (!pergolaId) return Boolean(module.geometryArtifact);
    const health = healthByPergolaId.get(pergolaId);
    return Boolean(module.geometryArtifact && (!health || health.canRenderCommittedBody));
  };
  const activeReady = input.activeModule && isRenderable(input.activeModule)
    ? input.activeModule
    : null;
  return activeReady ?? input.modules.find(isRenderable) ?? null;
}

export function buildProjectGeometryPreviewFromModules(input: {
  modules: ReadonlyArray<WorkbenchSolvedModule>;
  activeModule: WorkbenchSolvedModule | null;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
  projectPergolaRenderHealth: ReadonlyArray<ProjectPergolaRenderHealth>;
  projectPergolaFallbackPlanShapes?: ReadonlyArray<GeometryTopProjectionShape>;
  fallbackMessage?: string;
}): GeometryPreviewState {
  const renderablePergolas = renderablePergolaIds(input.projectPergolaRenderHealth);
  const readyModules = input.modules.filter(
    (module) =>
      module.geometryPreview.kind === 'ready' &&
      module.viewerScene &&
      Boolean(module.moduleInput.pergolaId && renderablePergolas.has(module.moduleInput.pergolaId)),
  );
  const basisModule = resolveProjectReadyBasisModule({
    modules: input.modules,
    activeModule: input.activeModule,
    projectPergolaRenderHealth: input.projectPergolaRenderHealth,
  });

  const projectPergolaIds = new Set(
    input.modules
      .map((module) => module.moduleInput.pergolaId)
      .filter((pergolaId): pergolaId is string => Boolean(pergolaId)),
  );
  const hasSuppressedPergola = input.projectPergolaRenderHealth.some(
    (entry) => entry.pergolaId && !entry.canRenderCommittedBody,
  );

  if (basisModule?.geometryPreview.kind === 'ready') {
    if (projectPergolaIds.size <= 1 && !hasSuppressedPergola) {
      return withProjectPreviewSource(basisModule.geometryPreview, 'project_pipeline');
    }

    return withProjectPreviewSource(
      {
        ...basisModule.geometryPreview,
        scene: buildProjectPergolaViewerSceneFromModules({
          basisScene: basisModule.geometryPreview.scene,
          modules: readyModules,
          projectHouseGeometries: input.projectHouseGeometries,
          projectPergolaRenderHealth: input.projectPergolaRenderHealth,
          projectPergolaFallbackPlanShapes: input.projectPergolaFallbackPlanShapes,
        }),
      },
      'project_pipeline',
    );
  }

  const carrier = readyPreviewCarrier({
    modules: input.modules,
    activeModule: input.activeModule,
  });
  if (carrier?.geometryPreview.kind === 'ready') {
    return withProjectPreviewSource(
      {
        ...carrier.geometryPreview,
        scene: buildProjectPergolaViewerSceneFromModules({
          basisScene: null,
          modules: [],
          projectHouseGeometries: input.projectHouseGeometries,
          projectPergolaRenderHealth: input.projectPergolaRenderHealth,
          projectPergolaFallbackPlanShapes: input.projectPergolaFallbackPlanShapes,
        }),
      },
      'diagnostic_project_scene',
    );
  }

  return {
    kind: 'error',
    message: input.fallbackMessage ?? 'No project 3D geometry preview is available.',
  };
}
