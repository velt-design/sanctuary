import {
  buildProjectReferenceShapes,
  type Assembly3D,
  type GeometryTopProjectionShape,
  type GeometryTopProjectionViewModel,
  type ProjectPergolaEntry,
  type ViewerSceneModel,
} from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { GeometryPreviewState, WorkbenchSolvedModule } from './workbenchSolvedModel';
import { resolveObjectFirstPergolaAttachment } from './objectFirstDerivedHosting';
import type { PergolaObjectModel, WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import {
  buildProjectHouseGeometryRegistry,
  type ProjectHouseGeometryEntry,
} from './projectHouseGeometryRegistry';
import {
  buildProjectHouseProjectionHealth,
  type ProjectHouseProjectionHealth,
} from './projectHouseProjectionHealth';
import { buildProjectPergolaPlanShapesFromModules } from './projectPergolaPlanShapes';
import { buildProjectPergolaViewerSceneFromModules } from './projectPergolaViewerScene';
import { buildProjectPlanProjection } from './projectPlanProjection';

type ProjectPergolaRenderSuppressionReason =
  | 'none'
  | 'missing_pergola_id'
  | 'missing_project_object'
  | 'unresolved_host'
  | 'invalid_geometry';

type ProjectPergolaHostAttachmentStatus =
  | 'resolved'
  | 'unresolved'
  | 'freestanding'
  | 'unknown';

export type ProjectPergolaRenderHealth = {
  pergolaId: string;
  moduleId: string;
  sourceKind: WorkbenchSolvedModule['sourceKind'];
  solveStatus: WorkbenchSolvedModule['renderStatus'];
  hostAttachmentStatus: ProjectPergolaHostAttachmentStatus;
  hostAttachmentCode: string | null;
  planBodyCount: number;
  sceneBodyCount: number;
  canRenderCommittedBody: boolean;
  suppressedCommittedBodyReason: ProjectPergolaRenderSuppressionReason;
};

export type ProjectObjectRenderPipeline = {
  projectHouseGeometries: ProjectHouseGeometryEntry[];
  projectPergolaPlanShapes: GeometryTopProjectionShape[];
  projectPergolaFallbackPlanShapes: GeometryTopProjectionShape[];
  projectHouseProjectionHealth: ProjectHouseProjectionHealth[];
  projectPergolaRenderHealth: ProjectPergolaRenderHealth[];
  projectPlanProjection: GeometryTopProjectionViewModel | null;
  projectReferenceShapes: GeometryTopProjectionShape[];
};

type ProjectPergolaSceneSource = {
  moduleInput: Pick<CalculatorModuleInputs, 'pergolaId'>;
  viewerScene: ViewerSceneModel | null;
};

function projectPergolaIdFromShape(shape: GeometryTopProjectionShape): string | null {
  const taggedPergolaId =
    typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null;
  return taggedPergolaId ?? shape.sourceObjectId ?? shape.sourceId ?? null;
}

function countPergolaSceneBodies(module: ProjectPergolaSceneSource): number {
  return (
    module.viewerScene?.layers
      .filter((layer) => layer.id !== 'house' && layer.id !== 'house_roof_materials')
      .reduce((count, layer) => count + layer.objects.length, 0) ?? 0
  );
}

function isFreestandingPergola(pergola: PergolaObjectModel): boolean {
  if (pergola.attachment) {
    return pergola.attachment.spatialKind === 'freestanding';
  }
  return pergola.connectionKind === 'freestanding' || pergola.strategy === 'none';
}

function resolvePergolaAttachmentHealth(input: {
  projectModel: WorkbenchProjectModel;
  pergola: PergolaObjectModel | null;
}): {
  hostAttachmentStatus: ProjectPergolaHostAttachmentStatus;
  hostAttachmentCode: string | null;
} {
  if (!input.pergola) {
    return { hostAttachmentStatus: 'unknown', hostAttachmentCode: null };
  }
  if (isFreestandingPergola(input.pergola)) {
    return { hostAttachmentStatus: 'freestanding', hostAttachmentCode: null };
  }
  const resolution = resolveObjectFirstPergolaAttachment({
    houseAssembly: input.projectModel.houseAssembly,
    pergola: input.pergola,
  });
  return {
    hostAttachmentStatus: resolution.status,
    hostAttachmentCode: resolution.code,
  };
}

function resolvePergolaSuppressionReason(input: {
  pergolaId: string | null;
  pergola: PergolaObjectModel | null;
  renderStatus: WorkbenchSolvedModule['renderStatus'];
  sourceKind: WorkbenchSolvedModule['sourceKind'];
  hostAttachmentStatus: ProjectPergolaHostAttachmentStatus;
}): ProjectPergolaRenderSuppressionReason {
  if (!input.pergolaId) return 'missing_pergola_id';
  if (input.renderStatus !== 'geometry_ready') return 'invalid_geometry';
  // Persisted calculator modules remain renderable during coexistence even if
  // their object-first host metadata has not been backfilled yet.
  if (input.sourceKind === 'drawing_module') return 'none';
  if (!input.pergola) return 'missing_project_object';
  if (input.hostAttachmentStatus === 'unresolved') return 'unresolved_host';
  return 'none';
}

function planBodyCountByPergolaId(
  shapes: ReadonlyArray<GeometryTopProjectionShape>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shape of shapes) {
    const pergolaId = projectPergolaIdFromShape(shape);
    if (!pergolaId) continue;
    counts.set(pergolaId, (counts.get(pergolaId) ?? 0) + 1);
  }
  return counts;
}

function buildProjectPergolaRenderHealth(input: {
  projectModel: WorkbenchProjectModel;
  modules: ReadonlyArray<WorkbenchSolvedModule>;
  projectPergolaPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): ProjectPergolaRenderHealth[] {
  const pergolaById = new Map(input.projectModel.pergolas.map((pergola) => [pergola.id, pergola]));
  const planCounts = planBodyCountByPergolaId(input.projectPergolaPlanShapes);
  const seenPergolaIds = new Set<string>();
  const health: ProjectPergolaRenderHealth[] = [];

  for (const module of input.modules) {
    const pergolaId = module.moduleInput.pergolaId ?? null;
    const healthKey = pergolaId ?? module.id;
    if (seenPergolaIds.has(healthKey)) continue;
    seenPergolaIds.add(healthKey);

    const pergola = pergolaId ? pergolaById.get(pergolaId) ?? null : null;
    const rawAttachmentHealth = resolvePergolaAttachmentHealth({
      projectModel: input.projectModel,
      pergola,
    });
    const attachmentHealth =
      module.sourceKind === 'drawing_module' && rawAttachmentHealth.hostAttachmentStatus === 'unresolved'
        ? { hostAttachmentStatus: 'unknown' as const, hostAttachmentCode: null }
        : rawAttachmentHealth;
    const suppressedCommittedBodyReason = resolvePergolaSuppressionReason({
      pergolaId,
      pergola,
      renderStatus: module.renderStatus,
      sourceKind: module.sourceKind,
      hostAttachmentStatus: attachmentHealth.hostAttachmentStatus,
    });
    const canRenderCommittedBody = suppressedCommittedBodyReason === 'none';

    health.push({
      pergolaId: pergolaId ?? '',
      moduleId: module.id,
      sourceKind: module.sourceKind,
      solveStatus: module.renderStatus,
      hostAttachmentStatus: attachmentHealth.hostAttachmentStatus,
      hostAttachmentCode: attachmentHealth.hostAttachmentCode,
      planBodyCount: pergolaId ? planCounts.get(pergolaId) ?? 0 : 0,
      sceneBodyCount: countPergolaSceneBodies(module),
      canRenderCommittedBody,
      suppressedCommittedBodyReason,
    });
  }

  return health;
}

function renderablePergolaIds(
  health: ReadonlyArray<ProjectPergolaRenderHealth>,
): Set<string> {
  return new Set(
    health
      .filter((entry) => entry.canRenderCommittedBody && entry.pergolaId)
      .map((entry) => entry.pergolaId),
  );
}

function filterCommittedPergolaPlanShapes(input: {
  shapes: ReadonlyArray<GeometryTopProjectionShape>;
  health: ReadonlyArray<ProjectPergolaRenderHealth>;
}): GeometryTopProjectionShape[] {
  const allowedIds = renderablePergolaIds(input.health);
  return input.shapes.filter((shape) => {
    const pergolaId = projectPergolaIdFromShape(shape);
    return Boolean(pergolaId && allowedIds.has(pergolaId));
  });
}

function buildProjectPergolaFallbackPlanShapes(input: {
  projectReferenceShapes: ReadonlyArray<GeometryTopProjectionShape>;
  health: ReadonlyArray<ProjectPergolaRenderHealth>;
}): GeometryTopProjectionShape[] {
  const healthByPergolaId = new Map(
    input.health
      .filter((entry) => entry.pergolaId && !entry.canRenderCommittedBody)
      .map((entry) => [entry.pergolaId, entry]),
  );
  return input.projectReferenceShapes
    .filter((shape) => shape.sourceType === 'pergola_reference')
    .filter((shape) => {
      const pergolaId = projectPergolaIdFromShape(shape);
      return Boolean(pergolaId && healthByPergolaId.has(pergolaId));
    })
    .map((shape) => {
      const pergolaId = projectPergolaIdFromShape(shape);
      const health = pergolaId ? healthByPergolaId.get(pergolaId) : null;
      return {
        ...shape,
        metadata: {
          ...(shape.metadata ?? {}),
          ...(pergolaId ? { pergolaId } : {}),
          renderRole: 'diagnostic_fallback',
          fallbackReason: health?.suppressedCommittedBodyReason ?? 'invalid_geometry',
          topProjectionRole: 'context',
        },
      };
    });
}

function buildProjectReferenceShapesFromModules(
  modules: ReadonlyArray<WorkbenchSolvedModule>,
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>,
): GeometryTopProjectionShape[] {
  const entries: ProjectPergolaEntry[] = [];
  for (let index = 0; index < modules.length; index += 1) {
    const module = modules[index]!;
    const assembly: Assembly3D | null = module.assembly;
    if (!assembly) continue;
    const pergolaSourceId =
      module.moduleInput.pergolaId ?? `pergola-${index + 1}`;
    entries.push({ assembly, pergolaSourceId });
  }
  const shapes: GeometryTopProjectionShape[] =
    entries.length === 0
      ? []
      : buildProjectReferenceShapes({
          pergolas: entries,
          houseSourceId: null,
        }).filter((shape) => shape.sourceType !== 'house_reference');
  const seenPergolaReferenceIds = new Set<string>();
  const dedupedShapes = shapes.filter((shape) => {
    if (shape.sourceType !== 'pergola_reference') return true;
    if (seenPergolaReferenceIds.has(shape.id)) return false;
    seenPergolaReferenceIds.add(shape.id);
    return true;
  });

  const seenHouseReferenceIds = new Set<string>();
  for (const entry of projectHouseGeometries) {
    const shape = entry.referenceShape;
    if (seenHouseReferenceIds.has(shape.id)) continue;
    seenHouseReferenceIds.add(shape.id);
    dedupedShapes.push(shape);
  }

  return dedupedShapes;
}

export function buildProjectObjectRenderPipeline(input: {
  projectModel: WorkbenchProjectModel;
  modules: ReadonlyArray<WorkbenchSolvedModule>;
  projectHouseGeometries?: ReadonlyArray<ProjectHouseGeometryEntry>;
}): ProjectObjectRenderPipeline {
  const projectHouseGeometries = [
    ...(input.projectHouseGeometries ?? buildProjectHouseGeometryRegistry(input.projectModel)),
  ];
  const projectReferenceShapes = buildProjectReferenceShapesFromModules(
    input.modules,
    projectHouseGeometries,
  );
  const rawProjectPergolaPlanShapes = buildProjectPergolaPlanShapesFromModules(input.modules);
  const projectPergolaRenderHealth = buildProjectPergolaRenderHealth({
    projectModel: input.projectModel,
    modules: input.modules,
    projectPergolaPlanShapes: rawProjectPergolaPlanShapes,
  });
  const projectPergolaPlanShapes = filterCommittedPergolaPlanShapes({
    shapes: rawProjectPergolaPlanShapes,
    health: projectPergolaRenderHealth,
  });
  const projectPergolaFallbackPlanShapes = buildProjectPergolaFallbackPlanShapes({
    projectReferenceShapes,
    health: projectPergolaRenderHealth,
  });
  const projectPlanProjection = buildProjectPlanProjection({
    projectHouseGeometries,
    projectPergolaPlanShapes,
  });
  const projectHouseProjectionHealth = buildProjectHouseProjectionHealth({
    houseFormIds: input.projectModel.houseAssembly?.houseForms.map((houseForm) => houseForm.id) ?? [],
    projectHouseGeometries,
    projectPlanProjection,
  });

  return {
    projectHouseGeometries,
    projectPergolaPlanShapes,
    projectPergolaFallbackPlanShapes,
    projectHouseProjectionHealth,
    projectPergolaRenderHealth,
    projectPlanProjection,
    projectReferenceShapes,
  };
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
  if (!basisModule || basisModule.geometryPreview.kind !== 'ready') {
    return (
      input.activeModule?.viewportGeometry.preview ?? {
        kind: 'error',
        message: input.fallbackMessage ?? 'No project 3D geometry preview is available.',
      }
    );
  }

  const projectPergolaIds = new Set(
    input.modules
      .map((module) => module.moduleInput.pergolaId)
      .filter((pergolaId): pergolaId is string => Boolean(pergolaId)),
  );
  const hasSuppressedPergola = input.projectPergolaRenderHealth.some(
    (entry) => entry.pergolaId && !entry.canRenderCommittedBody,
  );
  if (projectPergolaIds.size <= 1 && !hasSuppressedPergola) {
    return basisModule.geometryPreview;
  }

  return {
    ...basisModule.geometryPreview,
    scene: buildProjectPergolaViewerSceneFromModules({
      basisScene: basisModule.geometryPreview.scene,
      modules: readyModules,
      projectHouseGeometries: input.projectHouseGeometries,
      projectPergolaRenderHealth: input.projectPergolaRenderHealth,
      projectPergolaFallbackPlanShapes: input.projectPergolaFallbackPlanShapes,
    }),
  };
}
